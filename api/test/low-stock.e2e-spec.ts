import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { EnvironmentVariables } from '../src/config/env.validation';
import { LowStockResponse } from '../src/products/dto/low-stock.response';
import { ProductResponse } from '../src/products/dto/product.response';
import { RedisService } from '../src/redis/redis.service';
import { createTestApp, resetState, TestContext } from './utils/test-app';

/** Nothing listens on port 1: connections are refused immediately. */
const UNREACHABLE_REDIS_URL = 'redis://127.0.0.1:1';
/** Fail-fast budget: a Redis outage must not make requests noticeably slower. */
const MAX_DEGRADED_RESPONSE_MS = 1_000;

describe('Low-stock cache (e2e)', () => {
  const lowStock = (ctx: TestContext, query = '') =>
    request(ctx.app.getHttpServer()).get(`/products/low-stock${query}`);

  const createProduct = async (
    ctx: TestContext,
    sku: string,
    quantity: number,
  ): Promise<ProductResponse> => {
    const res = await request(ctx.app.getHttpServer())
      .post('/products')
      .send({ name: sku, sku, quantity, price: 1 })
      .expect(201);
    return res.body as ProductResponse;
  };

  const move = (
    ctx: TestContext,
    productId: string,
    type: 'IN' | 'OUT',
    quantity: number,
  ) =>
    request(ctx.app.getHttpServer())
      .post('/stock-movements')
      .send({ productId, type, quantity })
      .expect(201);

  const skus = (body: unknown): string[] =>
    (body as LowStockResponse).items.map((p) => p.sku);

  describe('with Redis available', () => {
    let ctx: TestContext;

    beforeAll(async () => {
      ctx = await createTestApp();
    });

    beforeEach(async () => {
      await resetState(ctx);
      await createProduct(ctx, 'EMPTY', 0);
      await createProduct(ctx, 'LOW', 4);
      await createProduct(ctx, 'EDGE', 10);
      await createProduct(ctx, 'PLENTY', 50);
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it('returns products strictly below the default threshold, most urgent first', async () => {
      const res = await lowStock(ctx).expect(200);
      const body = res.body as LowStockResponse;

      expect(body.threshold).toBe(10);
      expect(skus(body)).toEqual(['EMPTY', 'LOW']);
      expect(body.items[0].price).toBe('1.00');
    });

    it('first call is a MISS, second is a HIT with identical data', async () => {
      const first = await lowStock(ctx).expect(200);
      const second = await lowStock(ctx).expect(200);

      expect(first.headers['x-cache']).toBe('MISS');
      expect(second.headers['x-cache']).toBe('HIT');
      expect(second.body).toEqual(first.body);
    });

    it('stores one entry per threshold under low-stock:{threshold} with a TTL', async () => {
      await lowStock(ctx, '?threshold=5').expect(200);
      await lowStock(ctx, '?threshold=60').expect(200);

      expect((await ctx.redis.keys('low-stock:*')).sort()).toEqual([
        'low-stock:5',
        'low-stock:60',
      ]);
      expect(await ctx.redis.ttl('low-stock:5')).toBeGreaterThan(0);

      const res = await lowStock(ctx, '?threshold=60').expect(200);
      expect(res.headers['x-cache']).toBe('HIT');
      expect(skus(res.body)).toEqual(['EMPTY', 'LOW', 'EDGE', 'PLENTY']);
    });

    it('a stock movement invalidates the cache: next call is a MISS with fresh data', async () => {
      await lowStock(ctx).expect(200);
      await lowStock(ctx).expect(200); // warm: HIT

      const plenty = (
        await request(ctx.app.getHttpServer()).get('/products').expect(200)
      ).body as { items: ProductResponse[] };
      const plentyId = plenty.items.find((p) => p.sku === 'PLENTY')!.id;
      await move(ctx, plentyId, 'OUT', 45); // 50 -> 5: now low

      const res = await lowStock(ctx).expect(200);
      expect(res.headers['x-cache']).toBe('MISS');
      expect(skus(res.body)).toEqual(['EMPTY', 'LOW', 'PLENTY']);
    });

    it('creating a product invalidates the cache', async () => {
      await lowStock(ctx).expect(200);

      await createProduct(ctx, 'NEW-LOW', 1);

      const res = await lowStock(ctx).expect(200);
      expect(res.headers['x-cache']).toBe('MISS');
      expect(skus(res.body)).toEqual(['EMPTY', 'NEW-LOW', 'LOW']);
    });

    it.each([
      ['zero', 'threshold=0'],
      ['non-numeric', 'threshold=abc'],
      ['fractional', 'threshold=2.5'],
      ['unknown param', 'foo=1'],
    ])('returns 400 for a %s threshold', async (_case, query) => {
      await lowStock(ctx, `?${query}`).expect(400);
    });
  });

  describe('with Redis unavailable', () => {
    let ctx: TestContext;

    beforeAll(async () => {
      const unreachableConfig = {
        get: () => UNREACHABLE_REDIS_URL,
      } as unknown as ConfigService<EnvironmentVariables, true>;

      ctx = await createTestApp((builder) =>
        builder
          .overrideProvider(RedisService)
          .useFactory({ factory: () => new RedisService(unreachableConfig) }),
      );
    });

    beforeEach(async () => {
      await resetState(ctx);
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it('really is running without a Redis connection', () => {
      expect(ctx.redis.status).not.toBe('ready');
    });

    it('still serves correct data from the database, quickly', async () => {
      await createProduct(ctx, 'LOW', 3);
      await createProduct(ctx, 'PLENTY', 30);

      for (let call = 0; call < 2; call++) {
        const started = Date.now();
        const res = await lowStock(ctx).expect(200);

        expect(Date.now() - started).toBeLessThan(MAX_DEGRADED_RESPONSE_MS);
        // Back-to-back reads would be a HIT with a working cache.
        expect(res.headers['x-cache']).toBe('MISS');
        expect(skus(res.body)).toEqual(['LOW']);
      }
    });

    it('never reports a HIT and stays correct across writes', async () => {
      const product = await createProduct(ctx, 'ITEM', 20);

      await lowStock(ctx).expect(200);
      await move(ctx, product.id, 'OUT', 15); // invalidation fails silently; movement still succeeds
      const res = await lowStock(ctx).expect(200);

      expect(res.headers['x-cache']).toBe('MISS');
      expect(skus(res.body)).toEqual(['ITEM']);
    });
  });
});
