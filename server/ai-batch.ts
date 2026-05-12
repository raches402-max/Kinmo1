/**
 * OpenAI Batch API queue.
 *
 * Submit AI requests asynchronously for a 50% cost discount. Results return
 * within 24h (typically minutes-hours). Not for user-facing latency.
 *
 * Lifecycle per row in `ai_batch_requests`:
 *   pending → submitted → completed → (processor runs) → processed_at set
 *           ↓
 *         failed
 *
 * Workers:
 *   - submitPendingBatches() : pending rows → upload JSONL → submitted
 *   - pollAndDownloadBatches(): submitted batches → download results → completed/failed
 *   - processCompletedBatches(): completed rows → run registered processor → processed
 *
 * Adding a new call type: import this module and call registerProcessor()
 * with your callType + a handler. Callers queue with queueBatchRequest().
 */

import OpenAI from "openai";
import { randomUUID } from "crypto";
import { eq, and, inArray, sql, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { aiBatchRequests, type AiBatchRequest } from "@shared/schema";
import { logApiCall, calculateOpenAICost } from "./openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Max age before a still-submitted batch is considered abandoned and marked failed.
const BATCH_TIMEOUT_HOURS = 25;

type BatchCallType = string;

// Processor signature: receives the OpenAI response message + the row's
// context (whatever was passed to queueBatchRequest), returns when done.
type ProcessorFn = (
  resultPayload: unknown,
  context: Record<string, unknown>,
) => Promise<void>;

const processors = new Map<BatchCallType, ProcessorFn>();

export function registerProcessor(callType: BatchCallType, fn: ProcessorFn): void {
  processors.set(callType, fn);
}

/**
 * Queue an AI request for batch submission.
 * Returns the row id; the actual API call happens on a later submitter tick.
 */
export async function queueBatchRequest(
  callType: BatchCallType,
  requestPayload: Record<string, unknown>,
  context: Record<string, unknown> = {},
): Promise<string> {
  const customId = randomUUID();
  const [row] = await db
    .insert(aiBatchRequests)
    .values({
      callType,
      status: "pending",
      customId,
      requestPayload,
      context,
    })
    .returning({ id: aiBatchRequests.id });

  await logApiCall({
    service: "openai",
    method: `batch_queue:${callType}`,
    cacheStatus: "batch_submit",
    status: "success",
    responseTimeMs: 0,
    costEstimate: 0,
    parameters: { callType },
    metadata: { rowId: row.id, customId },
  });

  return row.id;
}

/**
 * Submit all pending rows to OpenAI as one batch per callType.
 * Updates rows to status=submitted with batch_id set.
 */
export async function submitPendingBatches(): Promise<void> {
  const pending = await db
    .select()
    .from(aiBatchRequests)
    .where(eq(aiBatchRequests.status, "pending"));

  if (pending.length === 0) return;

  // Group by callType — each callType becomes one batch
  const byCallType = new Map<string, AiBatchRequest[]>();
  for (const row of pending) {
    const list = byCallType.get(row.callType) ?? [];
    list.push(row);
    byCallType.set(row.callType, list);
  }

  for (const [callType, rows] of byCallType.entries()) {
    try {
      // Build JSONL: one line per request, custom_id matches our row's customId
      const jsonlLines = rows.map((row) =>
        JSON.stringify({
          custom_id: row.customId,
          method: "POST",
          url: "/v1/chat/completions",
          body: row.requestPayload,
        }),
      );
      const jsonlContent = jsonlLines.join("\n");

      // Upload as file
      const file = await openai.files.create({
        file: new File([jsonlContent], `batch-${callType}-${Date.now()}.jsonl`, {
          type: "application/jsonl",
        }),
        purpose: "batch",
      });

      // Create batch
      const batch = await openai.batches.create({
        input_file_id: file.id,
        endpoint: "/v1/chat/completions",
        completion_window: "24h",
      });

      // Update all rows in this group to submitted
      await db
        .update(aiBatchRequests)
        .set({
          status: "submitted",
          batchId: batch.id,
          submittedAt: new Date(),
        })
        .where(inArray(
          aiBatchRequests.id,
          rows.map((r) => r.id),
        ));

      console.log(
        `[AI Batch] Submitted ${rows.length} ${callType} requests as batch ${batch.id}`,
      );
    } catch (error) {
      const errMsg = (error as Error).message;
      console.error(`[AI Batch] Failed to submit ${callType} batch:`, errMsg);
      // Leave rows as pending; next tick will retry.
    }
  }
}

/**
 * Check status of all submitted batches; download results when complete,
 * write them back to the matching rows, mark completed or failed.
 */
export async function pollAndDownloadBatches(): Promise<void> {
  // Distinct batch_ids that are still in 'submitted' status
  const submittedRows = await db
    .select()
    .from(aiBatchRequests)
    .where(eq(aiBatchRequests.status, "submitted"));

  if (submittedRows.length === 0) return;

  const batchIds = Array.from(
    new Set(submittedRows.map((r) => r.batchId).filter((id): id is string => !!id)),
  );

  for (const batchId of batchIds) {
    try {
      const batch = await openai.batches.retrieve(batchId);

      if (batch.status === "completed" && batch.output_file_id) {
        await ingestBatchResults(batchId, batch.output_file_id);
      } else if (batch.status === "failed" || batch.status === "expired" || batch.status === "cancelled") {
        await db
          .update(aiBatchRequests)
          .set({
            status: "failed",
            errorMessage: `Batch ${batch.status}: ${batch.errors ? JSON.stringify(batch.errors) : "no error details"}`,
            completedAt: new Date(),
          })
          .where(eq(aiBatchRequests.batchId, batchId));
        console.error(`[AI Batch] Batch ${batchId} ${batch.status}`);
      }
      // else: still in_progress / validating / finalizing — leave alone
    } catch (error) {
      console.error(`[AI Batch] Error polling batch ${batchId}:`, (error as Error).message);
    }
  }

  // Mark stale submitted batches as failed (something went wrong upstream)
  const cutoff = new Date(Date.now() - BATCH_TIMEOUT_HOURS * 60 * 60 * 1000);
  await db
    .update(aiBatchRequests)
    .set({
      status: "failed",
      errorMessage: `Submitted but no result within ${BATCH_TIMEOUT_HOURS}h`,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(aiBatchRequests.status, "submitted"),
        lt(aiBatchRequests.submittedAt, cutoff),
      ),
    );
}

async function ingestBatchResults(batchId: string, outputFileId: string): Promise<void> {
  const fileResponse = await openai.files.content(outputFileId);
  const text = await fileResponse.text();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as {
        custom_id: string;
        response?: { status_code: number; body: any };
        error?: { message: string; code?: string };
      };

      if (obj.error || (obj.response && obj.response.status_code >= 400)) {
        const errMsg = obj.error?.message ?? `HTTP ${obj.response?.status_code}`;
        await db
          .update(aiBatchRequests)
          .set({
            status: "failed",
            errorMessage: errMsg,
            completedAt: new Date(),
          })
          .where(eq(aiBatchRequests.customId, obj.custom_id));
        continue;
      }

      const body = obj.response?.body;
      if (!body) continue;

      // Log the realized cost (half-priced) against the matching row
      const inputTokens = body.usage?.prompt_tokens ?? 0;
      const outputTokens = body.usage?.completion_tokens ?? 0;
      const modelName = (body.model ?? "gpt-4o-mini") as "gpt-4o" | "gpt-4o-mini";
      // Batch API is 50% off
      const costEstimate = calculateOpenAICost(modelName, inputTokens, outputTokens) * 0.5;

      const [updated] = await db
        .update(aiBatchRequests)
        .set({
          status: "completed",
          resultPayload: body,
          completedAt: new Date(),
        })
        .where(eq(aiBatchRequests.customId, obj.custom_id))
        .returning({ callType: aiBatchRequests.callType, id: aiBatchRequests.id });

      if (updated) {
        await logApiCall({
          service: "openai",
          method: `batch_complete:${updated.callType}`,
          cacheStatus: "batch_complete",
          status: "success",
          responseTimeMs: 0,
          costEstimate,
          parameters: { callType: updated.callType, batchId },
          metadata: {
            model: modelName,
            inputTokens,
            outputTokens,
            batchDiscount: true,
          },
        });
      }
    } catch (parseError) {
      console.error(`[AI Batch] Failed to parse result line:`, parseError);
    }
  }

  console.log(`[AI Batch] Ingested ${lines.length} results from batch ${batchId}`);
}

/**
 * For each completed row that hasn't been processed, run its registered
 * processor. Processor failures leave processed_at null so they can be
 * re-run; logs the error so it's visible.
 */
export async function processCompletedBatches(): Promise<void> {
  const completedRows = await db
    .select()
    .from(aiBatchRequests)
    .where(
      and(
        eq(aiBatchRequests.status, "completed"),
        isNull(aiBatchRequests.processedAt),
      ),
    );

  if (completedRows.length === 0) return;

  for (const row of completedRows) {
    const processor = processors.get(row.callType);
    if (!processor) {
      console.warn(`[AI Batch] No processor registered for callType=${row.callType}; row ${row.id} parked`);
      continue;
    }
    try {
      await processor(row.resultPayload, (row.context ?? {}) as Record<string, unknown>);
      await db
        .update(aiBatchRequests)
        .set({ processedAt: new Date() })
        .where(eq(aiBatchRequests.id, row.id));
    } catch (error) {
      console.error(`[AI Batch] Processor for ${row.callType} (row ${row.id}) threw:`, (error as Error).message);
      // Don't mark processed; will be picked up next tick. If it keeps failing,
      // operator can inspect row + result_payload manually.
    }
  }
}
