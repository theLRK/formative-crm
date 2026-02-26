import {
  clearExpiredIdempotencyKeys,
  hasProcessedIdempotencyKey,
  markIdempotencyKeyProcessed,
} from '../../src/lib/leads';

describe('idempotency cache', () => {
  it('marks and resolves processed keys', () => {
    const key = 'idem-1234';
    expect(hasProcessedIdempotencyKey(key)).toBe(false);
    markIdempotencyKeyProcessed(key, 5000);
    expect(hasProcessedIdempotencyKey(key)).toBe(true);
  });

  it('expires keys after ttl', async () => {
    const key = 'idem-expire';
    markIdempotencyKeyProcessed(key, 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    clearExpiredIdempotencyKeys();
    expect(hasProcessedIdempotencyKey(key)).toBe(false);
  });
});

