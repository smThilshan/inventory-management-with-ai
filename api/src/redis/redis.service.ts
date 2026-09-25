import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  REDIS_COMMAND_TIMEOUT_MS,
  REDIS_CONNECT_TIMEOUT_MS,
  REDIS_DISCONNECT_TIMEOUT_MS,
} from '../common/constants';
import { EnvironmentVariables } from '../config/env.validation';

/**
 * Redis is used only as a cache, so it is tuned to fail fast rather than be
 * reliable: while disconnected, commands reject immediately (no offline queue,
 * no per-command retries) and callers fall back to Postgres. The API boots and
 * serves traffic even if Redis is down; the client keeps reconnecting in the background.
 */
@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);
  private connectionLost = false;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super(config.get('REDIS_URL', { infer: true }), {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      disconnectTimeout: REDIS_DISCONNECT_TIMEOUT_MS,
    });

    // Log state transitions only, not every reconnect attempt, to avoid log floods.
    this.on('ready', () => {
      this.logger.log(this.connectionLost ? 'Reconnected' : 'Connected');
      this.connectionLost = false;
    });
    this.on('error', (error: Error) => {
      if (!this.connectionLost) {
        this.connectionLost = true;
        this.logger.warn(`Unavailable, cache disabled: ${error.message}`);
      }
    });
  }

  /**
   * Waits briefly for the first connection so the cache works from the first
   * request. Never blocks boot: an error or the timeout just means "start without cache".
   */
  async onModuleInit(): Promise<void> {
    if (this.status === 'ready') {
      return;
    }
    await new Promise<void>((resolve) => {
      const settle = (): void => {
        clearTimeout(timer);
        this.off('ready', settle);
        this.off('error', settle);
        resolve();
      };
      const timer = setTimeout(settle, REDIS_CONNECT_TIMEOUT_MS);
      this.once('ready', settle);
      this.once('error', settle);
    });
  }

  async onModuleDestroy(): Promise<void> {
    // quit() flushes pending replies but needs a live connection; otherwise just stop reconnecting.
    if (this.status === 'ready') {
      await this.quit();
    } else {
      this.disconnect();
    }
  }
}
