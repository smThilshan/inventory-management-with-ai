import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import {
  DEFAULT_CORS_ORIGIN,
  DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS,
  DEFAULT_LOW_STOCK_THRESHOLD,
  DEFAULT_PORT,
  DEFAULT_SWAGGER_ENABLED,
} from '../common/constants';

const MAX_TCP_PORT = 65535;

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
