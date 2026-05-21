import type { Response } from "express";

export interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
}

export interface FailureEnvelope {
  success: false;
  error: string;
  [extra: string]: unknown;
}

export function ok<T>(res: Response, data: T): Response {
  return res.json({ success: true, data });
}

export function fail(
  res: Response,
  status: number,
  error: string,
  extra?: Record<string, unknown>,
): Response {
  return res.status(status).json({ success: false, error, ...(extra ?? {}) });
}
