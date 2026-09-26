import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { todayIn } from '../src/common/calendar-date';
import { EnvironmentVariables } from '../src/config/env.validation';
import { InvoiceResponse } from '../src/invoices/dto/invoice.response';
import {
  INVOICE_CREATED_EVENT,
  InvoiceCreatedEvent,
} from '../src/invoices/events/invoice-created.event';
import { InvoiceSettings } from '../src/invoices/invoice-settings';
import { ProductResponse } from '../src/products/dto/product.response';
import {
  STOCK_UPDATED_EVENT,
  StockUpdatedEvent,
} from '../src/stock-movements/events/stock-updated.event';
import {
  createTestApp,
  listen,
  resetState,
  TestContext,
} from './utils/test-app';

const UNKNOWN_ID_A = '01990000-0000-7000-8000-00000000000a';
const UNKNOWN_ID_B = '01990000-0000-7000-8000-00000000000b';

interface ErrorBody {
  message: string | string[];
  productIds?: string[];
}

describe('Purchases (e2e)', () => {
  let ctx: TestContext;
  let baseUrl: string;
  let today: string;
  const received = {
    stock: [] as StockUpdatedEvent[],
    invoices: [] as InvoiceCreatedEvent[],
  };
  const onStock = (e: StockUpdatedEvent) => received.stock.push(e);
  const onInvoice = (e: InvoiceCreatedEvent) => received.invoices.push(e);

  beforeAll(async () => {
    ctx = await createTestApp();
    baseUrl = await listen(ctx);
    const events = ctx.app.get(EventEmitter2);
    events.on(STOCK_UPDATED_EVENT, onStock);
    events.on(INVOICE_CREATED_EVENT, onInvoice);
  });

  beforeEach(async () => {
    await resetState(ctx);
    received.stock = [];
    received.invoices = [];
    today = todayIn(ctx.app.get(InvoiceSettings).timeZone);
  });

  afterAll(async () => {
    const events = ctx.app.get(EventEmitter2);
    events.off(STOCK_UPDATED_EVENT, onStock);
    events.off(INVOICE_CREATED_EVENT, onInvoice);
    await ctx.app.close();
  });

  const http = () => request(baseUrl);
  const year = () => today.slice(0, 4);

  const createProduct = async (
    sku: string,
    quantity = 0,
    name = `Product ${sku}`,
  ): Promise<ProductResponse> =>
    (
      await http()
        .post('/products')
        .send({ name, sku, quantity, price: 100 })
        .expect(201)
    ).body as ProductResponse;

  const purchase = (body: object) => http().post('/purchases').send(body);

  const quantityOf = async (id: string) =>
    (await ctx.prisma.product.findUniqueOrThrow({ where: { id } })).quantity;

  const nothingWritten = async () => {
    expect(await ctx.prisma.invoice.count()).toBe(0);
    expect(await ctx.prisma.invoiceLine.count()).toBe(0);
    expect(
      await ctx.prisma.stockMovement.count({ where: { reason: 'PURCHASE' } }),
    ).toBe(0);
  };

  describe('POST /purchases', () => {
    it('creates one invoice with one line per product, in submitted order', async () => {
      const keyboard = await createProduct('KB-1', 0, 'Keyboard');
      const mouse = await createProduct('MS-1', 0, 'Mouse');

      const res = await purchase({
        supplierName: '  Acme Supplies LLC  ',
        lines: [
          { productId: mouse.id, quantity: 25, unitCost: 4.5 },
          { productId: keyboard.id, quantity: 10, unitCost: 45 },
        ],
      }).expect(201);
      const invoice = res.body as InvoiceResponse;

      expect(invoice).toMatchObject({
        invoiceNumber: `PUR-${year()}-0001`,
        type: 'PURCHASE',
        status: 'NOT_SENT',
        counterpartyName: 'Acme Supplies LLC',
        date: today,
        currency: 'AED',
        subtotal: '562.50',
        taxRate: '0',
        taxAmount: '0.00',
        total: '562.50',
      });
      expect(invoice.lines).toEqual([
        expect.objectContaining({
          lineNumber: 1,
          productId: mouse.id,
          description: 'Mouse',
          sku: 'MS-1',
          quantity: 25,
          unitPrice: '4.50',
          lineTotal: '112.50',
        }),
        expect.objectContaining({
          lineNumber: 2,
          productId: keyboard.id,
          description: 'Keyboard',
          sku: 'KB-1',
          quantity: 10,
          unitPrice: '45.00',
          lineTotal: '450.00',
        }),
      ]);
    });

    it('adds stock per line and links one PURCHASE movement per line to the invoice', async () => {
      const a = await createProduct('A-1', 5);
      const b = await createProduct('B-1', 0);
      const c = await createProduct('C-1', 2);

      const invoice = (
        await purchase({
          supplierName: 'Acme',
          lines: [
            { productId: a.id, quantity: 10, unitCost: 1 },
            { productId: b.id, quantity: 20, unitCost: 2 },
            { productId: c.id, quantity: 30, unitCost: 3 },
          ],
        }).expect(201)
      ).body as InvoiceResponse;

      expect(await quantityOf(a.id)).toBe(15);
      expect(await quantityOf(b.id)).toBe(20);
      expect(await quantityOf(c.id)).toBe(32);
      expect(await ctx.prisma.invoice.count()).toBe(1);
      expect(
        await ctx.prisma.invoiceLine.count({
          where: { invoiceId: invoice.id },
        }),
      ).toBe(3);

      const movements = await ctx.prisma.stockMovement.findMany({
        where: { invoiceId: invoice.id },
      });
      expect(movements).toHaveLength(3);
      expect(
        movements.every((m) => m.reason === 'PURCHASE' && m.type === 'IN'),
      ).toBe(true);
    });

    it('sets due date = invoice date + INVOICE_DUE_DAYS and accepts a past date', async () => {
      const p = await createProduct('P-1');

      const invoice = (
        await purchase({
          supplierName: 'Acme',
          date: '2025-12-15',
          lines: [{ productId: p.id, quantity: 1, unitCost: 1 }],
        }).expect(201)
      ).body as InvoiceResponse;

      expect(invoice.date).toBe('2025-12-15');
      expect(invoice.dueDate).toBe('2026-01-14');
      expect(invoice.invoiceNumber).toBe('PUR-2025-0001'); // numbered by the invoice's year
    });

    it('snapshots name and SKU: editing the product later does not change the invoice line', async () => {
      const p = await createProduct('SNAP-1', 0, 'Original Name');
      const invoice = (
        await purchase({
          supplierName: 'Acme',
          lines: [{ productId: p.id, quantity: 1, unitCost: 9.99 }],
        }).expect(201)
      ).body as InvoiceResponse;

      await ctx.prisma.product.update({
        where: { id: p.id },
        data: { name: 'Renamed', sku: 'SNAP-2', price: '1.00' },
      });

      const line = await ctx.prisma.invoiceLine.findFirstOrThrow({
        where: { invoiceId: invoice.id },
      });
      expect(line).toMatchObject({
        description: 'Original Name',
        sku: 'SNAP-1',
      });
      expect(line.unitPrice.toFixed(2)).toBe('9.99');
    });

    it('returns 404 listing every unknown product, and writes nothing (number not consumed)', async () => {
      const known = await createProduct('K-1', 3);

      const res = await purchase({
        supplierName: 'Acme',
        lines: [
          { productId: UNKNOWN_ID_A, quantity: 1, unitCost: 1 },
          { productId: known.id, quantity: 1, unitCost: 1 },
          { productId: UNKNOWN_ID_B, quantity: 1, unitCost: 1 },
        ],
      }).expect(404);

      expect(res.body).toMatchObject({
        message: 'Products not found',
        productIds: [UNKNOWN_ID_A, UNKNOWN_ID_B],
      });
      await nothingWritten();
      expect(await quantityOf(known.id)).toBe(3);

      const next = (
        await purchase({
          supplierName: 'Acme',
          lines: [{ productId: known.id, quantity: 1, unitCost: 1 }],
        }).expect(201)
      ).body as InvoiceResponse;
      expect(next.invoiceNumber).toBe(`PUR-${year()}-0001`);
    });

    it('rejects a future date', async () => {
      const p = await createProduct('F-1');

      const res = await purchase({
        supplierName: 'Acme',
        date: '2999-01-01',
        lines: [{ productId: p.id, quantity: 1, unitCost: 1 }],
      }).expect(400);

      expect((res.body as ErrorBody).message).toContain(
        'must not be in the future',
      );
      await nothingWritten();
    });

    it('turns an overflowing total into a 400 instead of a database error', async () => {
      const p = await createProduct('BIG-1');

      await purchase({
        supplierName: 'Acme',
        lines: [
          { productId: p.id, quantity: 1_000_000, unitCost: 99_999_999.99 },
        ],
      }).expect(400);

      await nothingWritten();
      expect(await quantityOf(p.id)).toBe(0);
    });

    describe('validation (400, nothing written)', () => {
      let productId: string;
      const line = () => ({ productId, quantity: 1, unitCost: 1 });

      beforeEach(async () => {
        productId = (await createProduct('V-1')).id;
      });

      it.each<[string, () => object]>([
        ['missing supplierName', () => ({ lines: [line()] })],
        [
          'supplierName of 1 character',
          () => ({ supplierName: 'A', lines: [line()] }),
        ],
        [
          'blank supplierName',
          () => ({ supplierName: '    ', lines: [line()] }),
        ],
        [
          'supplierName over 120 characters',
          () => ({ supplierName: 'x'.repeat(121), lines: [line()] }),
        ],
        ['missing lines', () => ({ supplierName: 'Acme' })],
        ['empty lines', () => ({ supplierName: 'Acme', lines: [] })],
        [
          'duplicate productId',
          () => ({ supplierName: 'Acme', lines: [line(), line()] }),
        ],
        [
          'quantity 0',
          () => ({ supplierName: 'Acme', lines: [{ ...line(), quantity: 0 }] }),
        ],
        [
          'fractional quantity',
          () => ({
            supplierName: 'Acme',
            lines: [{ ...line(), quantity: 1.5 }],
          }),
        ],
        [
          'quantity above 1,000,000',
          () => ({
            supplierName: 'Acme',
            lines: [{ ...line(), quantity: 1_000_001 }],
          }),
        ],
        [
          'unitCost 0',
          () => ({ supplierName: 'Acme', lines: [{ ...line(), unitCost: 0 }] }),
        ],
        [
          'negative unitCost',
          () => ({
            supplierName: 'Acme',
            lines: [{ ...line(), unitCost: -5 }],
          }),
        ],
        [
          'unitCost with 3 decimals',
          () => ({
            supplierName: 'Acme',
            lines: [{ ...line(), unitCost: 1.234 }],
          }),
        ],
        [
          'unitCost as a string',
          () => ({
            supplierName: 'Acme',
            lines: [{ ...line(), unitCost: '1.00' }],
          }),
        ],
        [
          'malformed productId',
          () => ({
            supplierName: 'Acme',
            lines: [{ ...line(), productId: 'abc' }],
          }),
        ],
        [
          'unknown field in a line',
          () => ({ supplierName: 'Acme', lines: [{ ...line(), discount: 5 }] }),
        ],
        [
          'unknown top-level field',
          () => ({ supplierName: 'Acme', lines: [line()], status: 'POSTED' }),
        ],
        [
          'date in wrong format',
          () => ({ supplierName: 'Acme', date: '15/12/2025', lines: [line()] }),
        ],
        [
          'impossible date',
          () => ({ supplierName: 'Acme', date: '2026-02-30', lines: [line()] }),
        ],
      ])('%s', async (_case, body) => {
        await purchase(body()).expect(400);
        await nothingWritten();
      });

      it('more than 50 lines', async () => {
        const lines = await Promise.all(
          Array.from({ length: 51 }, async (_, i) => ({
            productId: (await createProduct(`MANY-${i}`)).id,
            quantity: 1,
            unitCost: 1,
          })),
        );

        await purchase({ supplierName: 'Acme', lines }).expect(400);
        await nothingWritten();
      });
    });

    describe('events', () => {
      it('publishes stock.updated per product and invoice.created after commit', async () => {
        const a = await createProduct('EV-A', 1);
        const b = await createProduct('EV-B', 2);
        received.stock = [];

        const invoice = (
          await purchase({
            supplierName: 'Acme',
            lines: [
              { productId: a.id, quantity: 4, unitCost: 1 },
              { productId: b.id, quantity: 5, unitCost: 1 },
            ],
          }).expect(201)
        ).body as InvoiceResponse;

        expect(received.stock.map((e) => [e.sku, e.quantity]).sort()).toEqual([
          ['EV-A', 5],
          ['EV-B', 7],
        ]);
        expect(received.invoices).toEqual([
          {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            type: 'PURCHASE',
            counterpartyName: 'Acme',
            date: today,
            currency: 'AED',
            total: '9.00',
            status: 'NOT_SENT',
          },
        ]);
      });

      it('publishes nothing when the purchase fails', async () => {
        const a = await createProduct('EV-C', 1);
        received.stock = [];

        await purchase({
          supplierName: 'Acme',
          lines: [
            { productId: a.id, quantity: 1, unitCost: 1 },
            { productId: UNKNOWN_ID_A, quantity: 1, unitCost: 1 },
          ],
        }).expect(404);

        expect(received.stock).toHaveLength(0);
        expect(received.invoices).toHaveLength(0);
      });

      it('refreshes the low-stock cache (via stock.updated)', async () => {
        const low = await createProduct('LOW-1', 2);
        await http().get('/products/low-stock').expect(200);
        await http().get('/products/low-stock').expect('X-Cache', 'HIT');

        await purchase({
          supplierName: 'Acme',
          lines: [{ productId: low.id, quantity: 50, unitCost: 1 }],
        }).expect(201);

        const res = await http().get('/products/low-stock').expect(200);
        expect(res.headers['x-cache']).toBe('MISS');
        expect((res.body as { items: ProductResponse[] }).items).toHaveLength(
          0,
        );
      });
    });

    it('10 concurrent purchases get 10 unique, gap-free invoice numbers', async () => {
      const p = await createProduct('CONC-1');

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          purchase({
            supplierName: 'Acme',
            lines: [{ productId: p.id, quantity: 3, unitCost: 1 }],
          }),
        ),
      );

      expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
      const numbers = results
        .map((r) => (r.body as InvoiceResponse).invoiceNumber)
        .sort();
      expect(numbers).toEqual(
        Array.from(
          { length: 10 },
          (_, i) => `PUR-${year()}-${String(i + 1).padStart(4, '0')}`,
        ),
      );
      expect(await quantityOf(p.id)).toBe(30);
    });
  });

  describe('with 5% VAT configured', () => {
    let vatCtx: TestContext;

    beforeAll(async () => {
      vatCtx = await createTestApp((builder) =>
        builder.overrideProvider(InvoiceSettings).useFactory({
          factory: (config: ConfigService<EnvironmentVariables, true>) =>
            Object.assign(new InvoiceSettings(config), { taxRate: '0.05' }),
          inject: [ConfigService],
        }),
      );
    });

    beforeEach(async () => {
      await resetState(vatCtx);
    });

    afterAll(async () => {
      await vatCtx.app.close();
    });

    it('computes subtotal, tax (half-up) and total', async () => {
      const server = request(vatCtx.app.getHttpServer());
      const a = (
        await server
          .post('/products')
          .send({ name: 'A', sku: 'VAT-A', price: 1 })
          .expect(201)
      ).body as ProductResponse;
      const b = (
        await server
          .post('/products')
          .send({ name: 'B', sku: 'VAT-B', price: 1 })
          .expect(201)
      ).body as ProductResponse;

      const invoice = (
        await server
          .post('/purchases')
          .send({
            supplierName: 'Acme',
            lines: [
              { productId: a.id, quantity: 2, unitCost: 10.5 },
              { productId: b.id, quantity: 1, unitCost: 4.99 },
            ],
          })
          .expect(201)
      ).body as InvoiceResponse;

      expect(invoice).toMatchObject({
        subtotal: '25.99',
        taxRate: '0.05',
        taxAmount: '1.30', // 1.2995 rounded half-up
        total: '27.29',
      });
    });
  });
});
