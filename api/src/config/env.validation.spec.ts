import {
  DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS,
  DEFAULT_LOW_STOCK_THRESHOLD,
  DEFAULT_PORT,
} from '../common/constants';
import { validateEnv } from './env.validation';

const requiredEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv(requiredEnv);

    expect(env.PORT).toBe(DEFAULT_PORT);
    expect(env.LOW_STOCK_THRESHOLD).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    expect(env.LOW_STOCK_CACHE_TTL_SECONDS).toBe(
      DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS,
    );
  });

  it('coerces numeric strings from process.env', () => {
    const env = validateEnv({ ...requiredEnv, PORT: '4000' });

    expect(env.PORT).toBe(4000);
  });

  it.each(['DATABASE_URL', 'REDIS_URL'])(
    'fails fast when %s is missing',
    (key) => {
      const env: Record<string, unknown> = { ...requiredEnv };
      delete env[key];

      expect(() => validateEnv(env)).toThrow(key);
    },
  );

  it('rejects a non-integer threshold', () => {
    expect(() =>
      validateEnv({ ...requiredEnv, LOW_STOCK_THRESHOLD: 'ten' }),
    ).toThrow('LOW_STOCK_THRESHOLD');
  });

  describe('SWAGGER_ENABLED', () => {
    it('defaults to enabled', () => {
      expect(validateEnv(requiredEnv).SWAGGER_ENABLED).toBe(true);
    });

    it.each([
      ['true', true],
      ['false', false], // the trap: Boolean("false") === true
    ])('parses "%s" as %s', (raw, expected) => {
      expect(
        validateEnv({ ...requiredEnv, SWAGGER_ENABLED: raw }).SWAGGER_ENABLED,
      ).toBe(expected);
    });

    it.each(['yes', '1', ''])('rejects the ambiguous value "%s"', (raw) => {
      expect(() =>
        validateEnv({ ...requiredEnv, SWAGGER_ENABLED: raw }),
      ).toThrow('SWAGGER_ENABLED must be "true" or "false"');
    });
  });
});
