import request from 'supertest';
import { ProductResponse } from '../src/products/dto/product.response';
import { createTestApp, resetState, TestContext } from './utils/test-app';

/** Invoicing-era guarantees for the existing adjustment endpoint (POST /stock-movements). */
describe('Stock adjustments (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const http = () => request(ctx.app.getHttpServer());

  const createProduct = async (quantity: number): Promise<ProductResponse> =>
    (
      await http()
        .post('/products')
        .send({ name: 'Widget', sku: 'WG-001', quantity, price: 5 })
        .expect(201)
    ).body as ProductResponse;

  it('records adjustments with reason ADJUSTMENT and no invoice', async () => {
    const product = await createProduct(10);

    await http()
      .post('/stock-movements')
      .send({ productId: product.id, type: 'OUT', quantity: 2 })
      .expect(201);

    const movements = await ctx.prisma.stockMovement.findMany({
      where: { productId: product.id },
    });
    expect(movements).toHaveLength(2); // opening stock + the adjustment
    expect(
      movements.every((m) => m.reason === 'ADJUSTMENT' && m.invoiceId === null),
    ).toBe(true);
  });

  it('409 keeps its message and adds sku, requested and available', async () => {
    const product = await createProduct(2);

    const res = await http()
      .post('/stock-movements')
      .send({ productId: product.id, type: 'OUT', quantity: 5 })
      .expect(409);

    expect(res.body).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Insufficient stock',
      sku: 'WG-001',
      requested: 5,
      available: 2,
    });
  });
});
