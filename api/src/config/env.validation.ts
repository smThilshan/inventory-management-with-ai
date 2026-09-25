import { plainToInstance } from 'class-transformer';
import {
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
