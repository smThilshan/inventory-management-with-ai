import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { ProductResponse } from '../src/products/dto/product.response';
import {
  StockMovementResponse,
  StockMovementResultResponse,
} from '../src/stock-movements/dto/stock-movement.response';
import {
  STOCK_UPDATED_EVENT,
  StockUpdatedEvent,
} from '../src/stock-movements/events/stock-updated.event';
import { createTestApp, resetState, TestContext } from './utils/test-app';

interface ErrorBody {
  message: string | string[];
}

const UNKNOWN_PRODUCT_ID = '01990000-0000-7000-8000-000000000000';

describe('Stock movements (e2e)', () => {
  let ctx: TestContext;
  let received: StockUpdatedEvent[];
  const recordEvent = (event: StockUpdatedEvent) => received.push(event);

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.app.get(EventEmitter2).on(STOCK_UPDATED_EVENT, recordEvent);
  });

  beforeEach(async () => {
    await resetState(ctx);
    received = [];
  });

  afterAll(async () => {
    ctx.app.get(EventEmitter2).off(STOCK_UPDATED_EVENT, recordEvent);
    await ctx.app.close();
  });

  const http = () => request(ctx.app.getHttpServer());

  const createProduct = async (quantity: number): Promise<ProductResponse> => {
    const res = await http()
      .post('/products')
      .send({ name: 'Widget', sku: 'WG-001', quantity, price: 5 })
      .expect(201);
    return res.body as ProductResponse;
  };

  const move = (productId: string, type: 'IN' | 'OUT', quantity: number) =>
    http().post('/stock-movements').send({ productId, type, quantity });

  const currentQuantity = async (id: string): Promise<number> =>
    (await ctx.prisma.product.findUniqueOrThrow({ where: { id } })).quantity;

  /** Ledger invariant: replaying every movement must reproduce the stored quantity. */
  const ledgerBalance = async (productId: string): Promise<number> => {
    const movements = await ctx.prisma.stockMovement.findMany({
      where: { productId },
    });
    return movements.reduce(
      (sum, m) => sum + (m.type === 'IN' ? m.quantity : -m.quantity),
      0,
    );
  };

  describe('POST /stock-movements', () => {
    it('IN increases quantity and records a movement', async () => {
      const product = await createProduct(10);

      const res = await move(product.id, 'IN', 5).expect(201);
      const body = res.body as StockMovementResultResponse;

      expect(body.product.quantity).toBe(15);
      expect(body.movement).toMatchObject({
        productId: product.id,
        type: 'IN',
        quantity: 5,
      });
      expect(await currentQuantity(product.id)).toBe(15);
      expect(await ledgerBalance(product.id)).toBe(15);
    });

    it('OUT decreases quantity and stores the optional note', async () => {
      const product = await createProduct(10);

      const res = await http()
        .post('/stock-movements')
        .send({
          productId: product.id,
          type: 'OUT',
          quantity: 4,
          note: '  Order #1042  ',
        })
        .expect(201);
      const body = res.body as StockMovementResultResponse;

      expect(body.product.quantity).toBe(6);
      expect(body.movement.note).toBe('Order #1042');
      expect(await ledgerBalance(product.id)).toBe(6);
    });

    it('OUT down to exactly zero is allowed', async () => {
      const product = await createProduct(3);

      await move(product.id, 'OUT', 3).expect(201);

      expect(await currentQuantity(product.id)).toBe(0);
    });

    it('OUT more than stock returns 409 and changes nothing', async () => {
      const product = await createProduct(2);

      const res = await move(product.id, 'OUT', 3).expect(409);

      expect((res.body as ErrorBody).message).toBe('Insufficient stock');
      expect(await currentQuantity(product.id)).toBe(2);
      expect(
        await ctx.prisma.stockMovement.count({ where: { type: 'OUT' } }),
      ).toBe(0);
    });

    it.each(['IN', 'OUT'] as const)(
      'unknown product returns 404 (%s)',
      async (type) => {
        const res = await move(UNKNOWN_PRODUCT_ID, type, 1).expect(404);

        expect((res.body as ErrorBody).message).toBe('Product not found');
        expect(await ctx.prisma.stockMovement.count()).toBe(0);
      },
    );

    it.each([
      ['quantity 0', { type: 'OUT', quantity: 0 }],
      ['negative quantity', { type: 'IN', quantity: -5 }],
      ['fractional quantity', { type: 'IN', quantity: 1.5 }],
      ['quantity above 1,000,000', { type: 'IN', quantity: 1_000_001 }],
      ['unknown type', { type: 'ADJUST', quantity: 1 }],
      ['blank note', { type: 'IN', quantity: 1, note: '   ' }],
      ['extra field', { type: 'IN', quantity: 1, price: 1 }],
    ])('returns 400 for %s', async (_case, body) => {
      const product = await createProduct(10);

      await http()
        .post('/stock-movements')
        .send({ productId: product.id, ...body })
        .expect(400);
      expect(await currentQuantity(product.id)).toBe(10);
    });

    it('returns 400 for a malformed productId', async () => {
      await move('not-a-uuid', 'IN', 1).expect(400);
    });
  });

  describe('concurrency', () => {
    it('5 parallel OUT of 3 against stock 10: exactly 3 succeed, final qty 1', async () => {
      const product = await createProduct(10);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => move(product.id, 'OUT', 3)),
      );

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 201, 201, 409, 409]);

      const quantitiesSeen = responses
        .filter((r) => r.status === 201)
        .map((r) => (r.body as StockMovementResultResponse).product.quantity)
        .sort((a, b) => b - a);
      expect(quantitiesSeen).toEqual([7, 4, 1]);

      expect(await currentQuantity(product.id)).toBe(1);
      expect(await ledgerBalance(product.id)).toBe(1);
      expect(
        await ctx.prisma.stockMovement.count({ where: { type: 'OUT' } }),
      ).toBe(3);
    });

    it('a burst of mixed IN/OUT keeps quantity equal to the ledger and never negative', async () => {
      const product = await createProduct(5);

      await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          move(product.id, i % 3 === 0 ? 'IN' : 'OUT', 2),
        ),
      );

      const quantity = await currentQuantity(product.id);
      expect(quantity).toBeGreaterThanOrEqual(0);
      expect(await ledgerBalance(product.id)).toBe(quantity);
    });
  });

  describe('stock.updated event', () => {
    it('is emitted once on success with the committed quantity', async () => {
      const product = await createProduct(10);

      await move(product.id, 'OUT', 4).expect(201);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        productId: product.id,
        sku: 'WG-001',
        quantity: 6,
        movement: { type: 'OUT', quantity: 4 },
      });
    });

    it('is NOT emitted when the movement is rejected', async () => {
      const product = await createProduct(1);

      await move(product.id, 'OUT', 5).expect(409);
      await move(UNKNOWN_PRODUCT_ID, 'IN', 1).expect(404);
      await move(product.id, 'IN', 0).expect(400);

      expect(received).toHaveLength(0);
    });
  });

  describe('GET /products/:id/movements', () => {
    it('returns movements newest first', async () => {
      const product = await createProduct(10);
      await move(product.id, 'OUT', 1).expect(201);
      await move(product.id, 'IN', 2).expect(201);

      const res = await http()
        .get(`/products/${product.id}/movements`)
        .expect(200);
      const { items } = res.body as { items: StockMovementResponse[] };

      expect(items.map((m) => [m.type, m.quantity])).toEqual([
        ['IN', 2],
        ['OUT', 1],
        ['IN', 10], // opening stock
      ]);
    });

    it('caps the history at the latest 50 movements', async () => {
      const product = await createProduct(0);
      await ctx.prisma.stockMovement.createMany({
        data: Array.from({ length: 55 }, (_, i) => ({
          productId: product.id,
          type: 'IN' as const,
          quantity: 1,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        })),
      });

      const res = await http()
        .get(`/products/${product.id}/movements`)
        .expect(200);
      const { items } = res.body as { items: StockMovementResponse[] };

      expect(items).toHaveLength(50);
      expect(items[0].createdAt).toBe('2026-01-01T00:00:54.000Z');
    });

    it('returns 404 for an unknown product', async () => {
      await http().get(`/products/${UNKNOWN_PRODUCT_ID}/movements`).expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await http().get('/products/abc/movements').expect(400);
    });
  });
});
