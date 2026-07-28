import {
  collectMissingEnvKeys,
  isStrictEnvValidation,
  productionEnvSchema,
  shouldSkipEnvValidation,
  validateEnv,
} from './env';

describe('config/env strict validation', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/vendorly',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key-with-enough-length-0123456789',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-0123456789',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    TWILIO_ACCOUNT_SID: 'ACxxxxxxxx',
    TWILIO_AUTH_TOKEN: 'twilio-token',
    SENDGRID_API_KEY: 'SG.xxxxx',
    MUX_TOKEN_ID: 'mux-id',
    MUX_TOKEN_SECRET: 'mux-secret',
  };

  it('returns ENV payload when all production keys are present', () => {
    const result = validateEnv(base);
    expect(result?.STRIPE_SECRET_KEY).toBe('sk_test_123');
    expect(result?.MUX_TOKEN_ID).toBe('mux-id');
    expect(productionEnvSchema.safeParse(base).success).toBe(true);
  });

  it('throws MISSING_ENV_VARIABLE when Stripe keys are absent', () => {
    const env = { ...base, STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: undefined };
    expect(() => validateEnv(env)).toThrow(/MISSING_ENV_VARIABLE/);
    expect(collectMissingEnvKeys(env)).toEqual(
      expect.arrayContaining(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']),
    );
  });

  it('skips hard fail in development mode', () => {
    expect(isStrictEnvValidation({ NODE_ENV: 'development' })).toBe(false);
    expect(validateEnv({ NODE_ENV: 'development' })).toBeNull();
  });

  it('honors ENV_VALIDATION_SKIP', () => {
    expect(shouldSkipEnvValidation({ NODE_ENV: 'production', ENV_VALIDATION_SKIP: '1' })).toBe(
      true,
    );
    expect(
      validateEnv({ ...base, ENV_VALIDATION_SKIP: 'true' }),
    ).toBeNull();
  });
});
