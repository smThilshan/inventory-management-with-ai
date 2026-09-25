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
});
