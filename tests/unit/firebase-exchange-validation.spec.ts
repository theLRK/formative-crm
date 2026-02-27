import { firebaseExchangeSchema } from '../../src/lib/validation';

describe('firebaseExchangeSchema', () => {
  it('accepts valid id token payload', () => {
    const parsed = firebaseExchangeSchema.safeParse({
      idToken: 'a'.repeat(120),
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid id token payload', () => {
    const parsed = firebaseExchangeSchema.safeParse({
      idToken: '',
    });
    expect(parsed.success).toBe(false);
  });
});
