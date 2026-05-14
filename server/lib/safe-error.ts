/**
 * Return a client-safe message for a thrown error.
 *
 * In development: returns the real message so debugging stays ergonomic.
 * In production: returns `fallback` (default "Internal server error") unless
 * the error explicitly opts into being client-visible by setting
 * `(err as any).safe === true`. This prevents Drizzle SQL fragments,
 * file paths, and other internal details from leaking to clients in 500
 * responses.
 *
 * Use at every 500 callsite:
 *   res.status(500).json({ message: safeError(error) });
 *   res.status(500).json({ message: safeError(error, "Failed to do X") });
 */
export function safeError(err: unknown, fallback = "Internal server error"): string {
  const isErrorInstance = err instanceof Error;

  if (process.env.NODE_ENV !== "production") {
    if (isErrorInstance) return err.message || fallback;
    return String(err) || fallback;
  }

  if (isErrorInstance && (err as { safe?: boolean }).safe === true) {
    return err.message || fallback;
  }

  return fallback;
}
