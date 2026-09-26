import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  MaxLength,
  Min,
  validateSync,
} from 'class-validator';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  DEFAULT_CORS_ORIGIN,
  DEFAULT_CURRENCY,
  DEFAULT_INVOICE_DUE_DAYS,
  DEFAULT_INVOICE_STORAGE_DIR,
  DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS,
  DEFAULT_LOW_STOCK_THRESHOLD,
  DEFAULT_PORT,
  DEFAULT_SWAGGER_ENABLED,
  DEFAULT_TAX_RATE,
} from '../common/constants';

const MAX_TCP_PORT = 65535;
const TAX_RATE_PATTERN = /^0(\.\d{1,4})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MAX_INVOICE_DUE_DAYS = 365;
const COMPANY_FIELD_MAX_LENGTH = 255;

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  @IsInt()
  @Min(1)
  @Max(MAX_TCP_PORT)
  PORT: number = DEFAULT_PORT;

  @IsInt()
  @Min(0)
  LOW_STOCK_THRESHOLD: number = DEFAULT_LOW_STOCK_THRESHOLD;

  @IsInt()
  @Min(1)
  LOW_STOCK_CACHE_TTL_SECONDS: number = DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS;

  /** Comma-separated list of allowed browser origins. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN: string = DEFAULT_CORS_ORIGIN;

  /** Serve OpenAPI docs at /docs. Disable where the API surface should not be public. */
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    parseBooleanFlag(obj[key]),
  )
  @IsBoolean({ message: 'SWAGGER_ENABLED must be "true" or "false"' })
  SWAGGER_ENABLED: boolean = DEFAULT_SWAGGER_ENABLED;

  // ---- Invoicing ----

  /**
   * Kept as a string on purpose: it goes straight into Prisma.Decimal, so the
   * rate never passes through a JS float. 0 <= rate < 1, up to 4 decimals
   * (the Invoice.taxRate column is Decimal(5,4)).
   */
  @Matches(TAX_RATE_PATTERN, {
    message:
      'TAX_RATE must be a decimal fraction below 1 with up to 4 places, e.g. "0.05"',
  })
  TAX_RATE: string = DEFAULT_TAX_RATE;

  @Matches(CURRENCY_PATTERN, {
    message: 'CURRENCY must be a 3-letter ISO 4217 code, e.g. "AED"',
  })
  CURRENCY: string = DEFAULT_CURRENCY;

  @IsInt()
  @Min(0)
  @Max(MAX_INVOICE_DUE_DAYS)
  INVOICE_DUE_DAYS: number = DEFAULT_INVOICE_DUE_DAYS;

  /** Printed on every invoice. Required: a legal document needs the real issuer, not a placeholder. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMPANY_FIELD_MAX_LENGTH)
  COMPANY_NAME: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(COMPANY_FIELD_MAX_LENGTH)
  COMPANY_ADDRESS: string;

  /** Where generated PDFs are written (relative to the api working directory). */
  @IsString()
  @IsNotEmpty()
  INVOICE_STORAGE_DIR: string = DEFAULT_INVOICE_STORAGE_DIR;

  /**
   * IANA zone that defines "today" for invoice dates. Using UTC would reject a
   * same-day Dubai invoice as future-dated between 00:00 and 04:00 local time.
   */
  @IsTimeZone({
    message: 'BUSINESS_TIMEZONE must be an IANA time zone, e.g. "Asia/Dubai"',
  })
  BUSINESS_TIMEZONE: string = DEFAULT_BUSINESS_TIMEZONE;
}

// Reads the raw env string: implicit conversion would turn "false" into true
// (Boolean("false") === true). Unrecognised values are returned as-is so
// validation rejects them instead of guessing.
function parseBooleanFlag(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/**
 * Runs once at boot via ConfigModule. Throwing here aborts startup, so a
 * misconfigured deployment fails immediately instead of on the first request.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return env;
}
