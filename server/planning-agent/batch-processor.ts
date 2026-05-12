/**
 * Registers a batch-result processor for `planning_insight` requests.
 *
 * When a batched insight generation completes, this takes the OpenAI response
 * + the row's context (the original RawInsight), hydrates a PlanningInsightData,
 * and saves it. Same end-state as the sync path — just deferred.
 *
 * Import once at server startup (server/index.ts) to ensure the registry hook
 * fires before any batches complete.
 */

import { registerProcessor } from "../ai-batch";
import { hydrateInsightFromResponse } from "./message-generator";
import { saveInsight } from "./index";
import type { RawInsight } from "./types";

interface PlanningInsightContext {
  groupId: string;
  rawInsight: RawInsight;
}

registerProcessor("planning_insight", async (resultPayload, context) => {
  const ctx = context as unknown as PlanningInsightContext;
  if (!ctx?.rawInsight) {
    console.warn("[Planning Agent Batch] Missing rawInsight in context; skipping");
    return;
  }

  // resultPayload is the chat.completions response body
  const body = resultPayload as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = body?.choices?.[0]?.message?.content ?? null;

  // Rehydrate the dates that lost their Date type when serialized through jsonb.
  const rawInsight: RawInsight = {
    ...ctx.rawInsight,
    expiresAt: ctx.rawInsight.expiresAt ? new Date(ctx.rawInsight.expiresAt) : undefined,
  };

  const insightData = hydrateInsightFromResponse(rawInsight, content);
  await saveInsight(insightData);
});
