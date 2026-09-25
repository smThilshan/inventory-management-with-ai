import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'node:events';
import { EnvironmentVariables } from '../config/env.validation';
import { RedisService } from '../redis/redis.service';
import { ProductResponse } from './dto/product.response';
import { LowStockCache } from './low-stock.cache';

const TTL_SECONDS = 30;

const item: ProductResponse = {
  id: 'id-1',
  name: 'Keyboard',
  sku: 'KB-001',
  quantity: 2,
  price: '19.99',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('LowStockCache', () => {
  const config = {
    get: () => TTL_SECONDS,
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const createRedisMock = () =>
    Object.assign(new EventEmitter(), {
      status: 'ready',
      get: jest.fn<Promise<string | null>, [string]>(),
      set: jest.fn<Promise<'OK'>, unknown[]>(),
      scan: jest.fn<Promise<[string, string[]]>, unknown[]>(),
      unlink: jest.fn<Promise<number>, string[]>(),
    });
  let redis: ReturnType<typeof createRedisMock>;
  let cache: LowStockCache;

  beforeEach(() => {
    redis = createRedisMock();
    cache = new LowStockCache(redis as unknown as RedisService, config);
  });

  it('drops possibly-stale entries whenever Redis (re)connects', async () => {
    redis.scan.mockResolvedValue(['0', ['low-stock:10']]);

    redis.emit('ready');
    await new Promise(setImmediate);

    expect(redis.unlink).toHaveBeenCalledWith('low-stock:10');
  });

  describe('get', () => {
    it('returns parsed items on a hit, keyed by threshold', async () => {
      redis.get.mockResolvedValue(JSON.stringify([item]));

      await expect(cache.get(10)).resolves.toEqual([item]);
      expect(redis.get).toHaveBeenCalledWith('low-stock:10');
    });

    it('returns null on a miss', async () => {
      redis.get.mockResolvedValue(null);

      await expect(cache.get(10)).resolves.toBeNull();
    });

    it('treats a Redis failure as a miss instead of throwing', async () => {
      redis.status = 'reconnecting';
      redis.get.mockRejectedValue(new Error('Connection is closed'));

      await expect(cache.get(10)).resolves.toBeNull();
    });

    it('treats a corrupt entry as a miss', async () => {
      redis.get.mockResolvedValue('{not json');

      await expect(cache.get(10)).resolves.toBeNull();
    });
  });

  describe('set', () => {
    it('stores JSON with the configured TTL', async () => {
      await cache.set(10, [item]);

      expect(redis.set).toHaveBeenCalledWith(
        'low-stock:10',
        JSON.stringify([item]),
        'EX',
        TTL_SECONDS,
      );
    });

    it('swallows Redis failures', async () => {
      redis.set.mockRejectedValue(new Error('timeout'));

      await expect(cache.set(10, [item])).resolves.toBeUndefined();
    });
  });

  describe('invalidateAll', () => {
    it('SCANs every page and UNLINKs matching keys (never KEYS)', async () => {
      redis.scan
        .mockResolvedValueOnce(['42', ['low-stock:5', 'low-stock:10']])
        .mockResolvedValueOnce(['0', ['low-stock:20']]);

      await cache.invalidateAll();

      expect(redis.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'low-stock:*',
        'COUNT',
        expect.any(Number),
      );
      expect(redis.scan).toHaveBeenNthCalledWith(
        2,
        '42',
        'MATCH',
        'low-stock:*',
        'COUNT',
        expect.any(Number),
      );
      expect(redis.unlink).toHaveBeenCalledWith('low-stock:5', 'low-stock:10');
      expect(redis.unlink).toHaveBeenCalledWith('low-stock:20');
    });

    it('skips UNLINK for empty SCAN pages', async () => {
      redis.scan.mockResolvedValueOnce(['0', []]);

      await cache.invalidateAll();

      expect(redis.unlink).not.toHaveBeenCalled();
    });

    it('swallows Redis failures (TTL bounds staleness)', async () => {
      redis.scan.mockRejectedValue(new Error('Connection is closed'));

      await expect(cache.invalidateAll()).resolves.toBeUndefined();
    });
  });
});
