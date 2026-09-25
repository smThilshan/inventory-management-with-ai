import type {
  OpenAPIObject,
  OperationObject,
  PathItemObject,
  SchemaObject,
} from '@nestjs/swagger';
import request from 'supertest';
import {
  MOVEMENT_MAX_QUANTITY,
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_SKU_MAX_LENGTH,
  PRODUCT_SKU_PATTERN,
} from '../src/common/constants';
import { MovementType } from '../src/generated/prisma/client';
import { ProductResponse } from '../src/products/dto/product.response';
import { createTestApp, resetState, TestContext } from './utils/test-app';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

describe('API docs (e2e)', () => {
  let ctx: TestContext;
  let doc: OpenAPIObject;

  beforeAll(async () => {
    ctx = await createTestApp();
    doc = (await request(ctx.app.getHttpServer()).get('/docs-json').expect(200))
      .body as OpenAPIObject;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const schema = (name: string): SchemaObject =>
    doc.components!.schemas![name] as SchemaObject;
  const property = (schemaName: string, prop: string): SchemaObject =>
    schema(schemaName).properties![prop] as SchemaObject;
  const operations = (): OperationObject[] =>
    Object.values(doc.paths).flatMap((item: PathItemObject) =>
      HTTP_METHODS.flatMap((m) => (item[m] ? [item[m]] : [])),
    );

  it('serves Swagger UI at /docs', async () => {
    await request(ctx.app.getHttpServer())
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/);
  });

  it('documents every route with a unique, stable operationId and a tag', () => {
    const routeByOperationId: [string, string][] = Object.entries(
      doc.paths,
    ).flatMap(([path, item]: [string, PathItemObject]) =>
      HTTP_METHODS.flatMap((m): [string, string][] => {
        const operation = item[m];
        return operation
          ? [[operation.operationId ?? '', `${m.toUpperCase()} ${path}`]]
          : [];
      }),
    );
    const byId = Object.fromEntries(routeByOperationId);

    expect(byId).toEqual({
      createProduct: 'POST /products',
      listProducts: 'GET /products',
      listLowStockProducts: 'GET /products/low-stock',
      createStockMovement: 'POST /stock-movements',
      listProductMovements: 'GET /products/{productId}/movements',
      streamStockEvents: 'GET /events/stock',
    });
    expect(operations().every((op) => (op.tags ?? []).length > 0)).toBe(true);
  });

  describe('schemas match the validation rules (no drift)', () => {
    it('CreateProductDto', () => {
      expect(schema('CreateProductDto').required).toEqual([
        'name',
        'sku',
        'price',
      ]);
      expect(property('CreateProductDto', 'name').maxLength).toBe(
        PRODUCT_NAME_MAX_LENGTH,
      );
      expect(property('CreateProductDto', 'sku')).toMatchObject({
        maxLength: PRODUCT_SKU_MAX_LENGTH,
        pattern: PRODUCT_SKU_PATTERN.source,
      });
    });

    it('CreateStockMovementDto', () => {
      expect(schema('CreateStockMovementDto').required).toEqual([
        'productId',
        'type',
        'quantity',
      ]);
      expect(property('CreateStockMovementDto', 'quantity')).toMatchObject({
        minimum: 1,
        maximum: MOVEMENT_MAX_QUANTITY,
      });
    });

    it('MovementType enum mirrors the database enum', () => {
      expect(schema('MovementType').enum).toEqual(Object.values(MovementType));
    });

    it('pagination query parameters', () => {
      const params = doc.paths['/products'].get!.parameters as {
        name: string;
        schema: SchemaObject;
      }[];
      const limit = params.find((p) => p.name === 'limit')!;
      expect(limit.schema).toMatchObject({
        default: PAGINATION_DEFAULT_LIMIT,
        maximum: PAGINATION_MAX_LIMIT,
      });
    });

    it('documents the X-Cache header on the low-stock endpoint', () => {
      const ok = doc.paths['/products/low-stock'].get!.responses['200'] as {
        headers: Record<string, unknown>;
      };
      expect(ok.headers).toHaveProperty('X-Cache');
    });
  });

  describe('real responses have exactly the documented fields', () => {
    const documentedFields = (name: string): string[] =>
      Object.keys(schema(name).properties ?? {}).sort();

    beforeEach(async () => {
      await resetState(ctx);
    });

    it('ProductResponse and StockMovementResultResponse', async () => {
      const http = () => request(ctx.app.getHttpServer());
      const product = (
        await http()
          .post('/products')
          .send({ name: 'Doc', sku: 'DOC-1', quantity: 5, price: 1 })
          .expect(201)
      ).body as ProductResponse;
      const result = (
        await http()
          .post('/stock-movements')
          .send({ productId: product.id, type: 'OUT', quantity: 1 })
          .expect(201)
      ).body as { product: object; movement: object };

      expect(Object.keys(product).sort()).toEqual(
        documentedFields('ProductResponse'),
      );
      expect(Object.keys(result).sort()).toEqual(
        documentedFields('StockMovementResultResponse'),
      );
      expect(Object.keys(result.movement).sort()).toEqual(
        documentedFields('StockMovementResponse'),
      );
    });
  });
});
