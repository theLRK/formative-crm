const submissionCache = new Map<string, number>();
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

export function hasProcessedIdempotencyKey(idempotencyKey: string): boolean {
  const expiresAt = submissionCache.get(idempotencyKey);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    submissionCache.delete(idempotencyKey);
    return false;
  }
  return true;
}

export function markIdempotencyKeyProcessed(idempotencyKey: string, ttlMs = DEFAULT_TTL_MS): void {
  submissionCache.set(idempotencyKey, Date.now() + ttlMs);
}

export function clearExpiredIdempotencyKeys(): void {
  const now = Date.now();
  for (const [key, expiresAt] of submissionCache.entries()) {
    if (expiresAt <= now) submissionCache.delete(key);
  }
}

