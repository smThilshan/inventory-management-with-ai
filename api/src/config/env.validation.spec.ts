import {
  DEFAULT_CURRENCY,
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_INVOICE_STORAGE_DIR,
  DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS,
  DEFAULT_LOW_STOCK_THRESHOLD,
  DEFAULT_PORT,
  DEFAULT_TAX_RATE,
} from '../common/constants';
import { validateEnv } from './env.validation';

const requiredEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  COMPANY_NAME: 'Demo Trading LLC',
  COMPANY_ADDRESS: 'Business Bay, Dubai',
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

  it.each(['DATABASE_URL', 'REDIS_URL', 'COMPANY_NAME', 'COMPANY_ADDRESS'])(
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

  describe('invoicing', () => {
    it('applies defaults', () => {
      const env = validateEnv(requiredEnv);

      expect(env.TAX_RATE).toBe(DEFAULT_TAX_RATE);
      expect(env.CURRENCY).toBe(DEFAULT_CURRENCY);
      expect(env.INVOICE_DUE_DAYS).toBe(DEFAULT_INVOICE_DUE_DAYS);
      expect(env.INVOICE_STORAGE_DIR).toBe(DEFAULT_INVOICE_STORAGE_DIR);
    });

    it('keeps TAX_RATE as an exact string (never a float)', () => {
      const env = validateEnv({ ...requiredEnv, TAX_RATE: '0.0750' });

      expect(env.TAX_RATE).toBe('0.0750');
    });

    it.each(['0', '0.05', '0.1', '0.9999'])('accepts TAX_RATE "%s"', (rate) => {
      expect(validateEnv({ ...requiredEnv, TAX_RATE: rate }).TAX_RATE).toBe(
        rate,
      );
    });

    it.each([
      ['5', 'a percentage instead of a fraction'],
      ['1', '100% or more'],
      ['0.12345', 'more than 4 decimals'],
      ['-0.05', 'negative'],
      ['abc', 'not a number'],
    ])('rejects TAX_RATE "%s" (%s)', (rate) => {
      expect(() => validateEnv({ ...requiredEnv, TAX_RATE: rate })).toThrow(
        'TAX_RATE must be a decimal fraction below 1',
      );
    });

    it.each(['aed', 'AE', 'DIRHAM'])('rejects CURRENCY "%s"', (currency) => {
      expect(() => validateEnv({ ...requiredEnv, CURRENCY: currency })).toThrow(
        'CURRENCY must be a 3-letter ISO 4217 code',
      );
    });

    it.each(['-1', '366', '7.5'])('rejects INVOICE_DUE_DAYS "%s"', (days) => {
      expect(() =>
        validateEnv({ ...requiredEnv, INVOICE_DUE_DAYS: days }),
      ).toThrow('INVOICE_DUE_DAYS');
    });

    it('defaults BUSINESS_TIMEZONE to Asia/Dubai and accepts other IANA zones', () => {
      expect(validateEnv(requiredEnv).BUSINESS_TIMEZONE).toBe('Asia/Dubai');
      expect(
        validateEnv({ ...requiredEnv, BUSINESS_TIMEZONE: 'Europe/London' })
          .BUSINESS_TIMEZONE,
      ).toBe('Europe/London');
    });

    it.each(['Dubai', 'GMT+4', 'Mars/Base'])(
      'rejects BUSINESS_TIMEZONE "%s"',
      (zone) => {
        expect(() =>
          validateEnv({ ...requiredEnv, BUSINESS_TIMEZONE: zone }),
        ).toThrow('BUSINESS_TIMEZONE must be an IANA time zone');
      },
    );
  });
});
