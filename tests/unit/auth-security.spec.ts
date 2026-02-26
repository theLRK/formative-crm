import { hashPassword, signAccessToken, verifyAccessToken, verifyPassword } from '../../src/lib/auth';
import { clearRateLimitBuckets, consumeRateLimit } from '../../src/lib/security';

describe('auth and security utilities', () => {
  afterEach(() => {
    clearRateLimitBuckets();
  });

  it('hashes and verifies passwords using bcrypt', async () => {
    const password = 'Password123';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('WrongPassword1', hash)).toBe(false);
  });

  it('signs and verifies access tokens', () => {
    const token = signAccessToken({ sub: 'user-1', role: 'admin' }, 'secret');
    const payload = verifyAccessToken(token, 'secret');
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('admin');
  });

  it('enforces rate limit windows', () => {
    const key = 'login:1.2.3.4';
    expect(consumeRateLimit(key, 2, 1000).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 1000).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 1000).allowed).toBe(false);
  });
});

