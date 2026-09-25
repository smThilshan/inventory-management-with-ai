import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CACHE_SCAN_BATCH_SIZE,
  LOW_STOCK_CACHE_KEY_PREFIX,
} from '../common/constants';
import { EnvironmentVariables } from '../config/env.validation';
import { RedisService } from '../redis/redis.service';
import { STOCK_UPDATED_EVENT } from '../stock-movements/events/stock-updated.event';
import { ProductResponse } from './dto/product.response';

const keyFor = (threshold: number): string =>
  `${LOW_STOCK_CACHE_KEY_PREFIX}${threshold}`;

/**
 * Cache-aside store for the low-stock query. Every method is best-effort:
 * a Redis failure is treated as a miss (reads) or a no-op (writes), so the
 * cache can make requests faster but never make them fail.
 */
@Injectable()
export class LowStockCache {
  private readonly logger = new Logger(LowStockCache.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlSeconds = config.get('LOW_STOCK_CACHE_TTL_SECONDS', {
      infer: true,
    });

    // Invalidations fail while Redis is unreachable (and while the API is down),
    // so entries that survived may be stale. Drop them on every (re)connect.
    this.redis.on('ready', () => void this.invalidateAll());
  }

  async get(threshold: number): Promise<ProductResponse[] | null> {
    try {
      const cached = await this.redis.get(keyFor(threshold));
      return cached === null ? null : (JSON.parse(cached) as ProductResponse[]);
    } catch (error: unknown) {
      this.reportFailure('read', error);
      return null;
    }
  }

  async set(threshold: number, items: ProductResponse[]): Promise<void> {
    try {
      await this.redis.set(
        keyFor(threshold),
        JSON.stringify(items),
        'EX',
        this.ttlSeconds,
      );
    } catch (error: unknown) {
      this.reportFailure('write', error);
    }
  }

  /**
   * Any stock change can move a product across any threshold, so every cached
   * threshold is dropped. SCAN walks the keyspace incrementally (KEYS would
   * block Redis), and UNLINK frees memory off the main thread.
   */
  @OnEvent(STOCK_UPDATED_EVENT)
  async invalidateAll(): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${LOW_STOCK_CACHE_KEY_PREFIX}*`,
          'COUNT',
          CACHE_SCAN_BATCH_SIZE,
        );
        if (keys.length > 0) {
          await this.redis.unlink(...keys);
        }
        cursor = nextCursor;
      } while (cursor !== '0');
    } catch (error: unknown) {
      // A missed invalidation is bounded by the TTL, never permanent staleness.
      this.reportFailure('invalidate', error);
    }
  }

  // While Redis is down, RedisService has already warned once; logging every
  // request would flood the logs. Failures on a live connection are unexpected.
  private reportFailure(operation: string, error: unknown): void {
    const message = `Cache ${operation} failed, using database: ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (this.redis.status === 'ready') {
      this.logger.warn(message);
    } else {
      this.logger.debug(message);
    }
  }
}
