import request from 'supertest';
import { Paginated } from '../src/common/pagination/paginated';
import { ProductResponse } from '../src/products/dto/product.response';
import { createTestApp, resetState, TestContext } from './utils/test-app';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

const validProduct = {
  name: 'Mechanical Keyboard',
  sku: 'KB-MECH-001',
  quantity: 12,
  price: 89.9,
};

describe('Products (e2e)', () => {
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

  describe('POST /products', () => {
    it('creates a product and returns 201 with the serialized body', async () => {
      const res = await http().post('/products').send(validProduct).expect(201);
      const body = res.body as ProductResponse;

      expect(body).toMatchObject({
        name: 'Mechanical Keyboard',
        sku: 'KB-MECH-001',
        quantity: 12,
        price: '89.90',
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body.createdAt).toEqual(expect.any(String));
    });

    it('records the opening stock as an IN movement', async () => {
      const res = await http().post('/products').send(validProduct).expect(201);
      const { id } = res.body as ProductResponse;

      const movements = await ctx.prisma.stockMovement.findMany({
        where: { productId: id },
      });
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({ type: 'IN', quantity: 12 });
    });

    it('defaults quantity to 0 and writes no movement', async () => {
      const { name, sku, price } = validProduct;

      const res = await http()
        .post('/products')
        .send({ name, sku, price })
        .expect(201);

      expect((res.body as ProductResponse).quantity).toBe(0);
      expect(await ctx.prisma.stockMovement.count()).toBe(0);
    });

    it('returns 409 for a duplicate SKU', async () => {
      await http().post('/products').send(validProduct).expect(201);

      const res = await http()
        .post('/products')
        .send({ ...validProduct, name: 'Another' })
        .expect(409);

      expect((res.body as ErrorBody).message).toBe('SKU already exists');
      expect(await ctx.prisma.product.count()).toBe(1);
    });

    it.each([
      ['negative quantity', { ...validProduct, quantity: -1 }],
      ['fractional quantity', { ...validProduct, quantity: 1.5 }],
      ['missing name', { ...validProduct, name: undefined }],
      ['blank name', { ...validProduct, name: '   ' }],
      ['lowercase sku', { ...validProduct, sku: 'kb-001' }],
      ['price with 3 decimals', { ...validProduct, price: 1.999 }],
      ['zero price', { ...validProduct, price: 0 }],
      ['price as string', { ...validProduct, price: '10.00' }],
      ['unknown extra field', { ...validProduct, isAdmin: true }],
    ])('returns 400 for %s', async (_case, body) => {
      await http().post('/products').send(body).expect(400);
      expect(await ctx.prisma.product.count()).toBe(0);
    });
  });

  describe('GET /products', () => {
    const createProducts = async (count: number): Promise<void> => {
      for (let i = 1; i <= count; i++) {
        await http()
          .post('/products')
          .send({ ...validProduct, sku: `SKU-${i}`, name: `Product ${i}` })
          .expect(201);
      }
    };

    it('walks all pages via nextCursor in creation order', async () => {
      await createProducts(5);

      const first = (await http().get('/products?limit=2').expect(200))
        .body as Paginated<ProductResponse>;
      const second = (
        await http()
          .get(`/products?limit=2&cursor=${first.nextCursor}`)
          .expect(200)
      ).body as Paginated<ProductResponse>;
      const last = (
        await http()
          .get(`/products?limit=2&cursor=${second.nextCursor}`)
          .expect(200)
      ).body as Paginated<ProductResponse>;

      expect(first.items.map((p) => p.sku)).toEqual(['SKU-1', 'SKU-2']);
      expect(second.items.map((p) => p.sku)).toEqual(['SKU-3', 'SKU-4']);
      expect(last.items.map((p) => p.sku)).toEqual(['SKU-5']);
      expect(first.nextCursor).toEqual(expect.any(String));
      expect(last.nextCursor).toBeNull();
    });

    it('defaults to 20 items per page', async () => {
      await createProducts(21);

      const page = (await http().get('/products').expect(200))
        .body as Paginated<ProductResponse>;

      expect(page.items).toHaveLength(20);
      expect(page.nextCursor).not.toBeNull();
    });

    it('returns an empty page when there are no products', async () => {
      const res = await http().get('/products').expect(200);

      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it.each([
      ['limit above max', 'limit=101'],
      ['limit of zero', 'limit=0'],
      ['non-numeric limit', 'limit=abc'],
      ['malformed cursor', 'cursor=not-a-uuid'],
      ['unknown query param', 'sort=name'],
    ])('returns 400 for %s', async (_case, query) => {
      await http().get(`/products?${query}`).expect(400);
    });
  });
});
