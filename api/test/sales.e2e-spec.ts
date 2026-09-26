import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { todayIn } from '../src/common/calendar-date';
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

const UNKNOWN_ID = '01990000-0000-7000-8000-00000000000a';

interface ShortageBody {
  statusCode: number;
  message: string;
  shortages: {
    productId: string;
    sku: string;
    requested: number;
    available: number;
  }[];
}

describe('Sales (e2e)', () => {
  let ctx: TestContext;
  let baseUrl: string;
  let year: string;
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
    year = todayIn(ctx.app.get(InvoiceSettings).timeZone).slice(0, 4);
  });

  afterAll(async () => {
    const events = ctx.app.get(EventEmitter2);
    events.off(STOCK_UPDATED_EVENT, onStock);
    events.off(INVOICE_CREATED_EVENT, onInvoice);
    await ctx.app.close();
  });

  const http = () => request(baseUrl);
  const number = (n: number) => `SAL-${year}-${String(n).padStart(4, '0')}`;

  const createProduct = async (
    sku: string,
    quantity: number,
    price: number,
    name = `Product ${sku}`,
  ): Promise<ProductResponse> =>
    (
      await http()
        .post('/products')
        .send({ name, sku, quantity, price })
        .expect(201)
    ).body as ProductResponse;

  const sell = (body: object) => http().post('/sales').send(body);

  const quantityOf = async (id: string) =>
    (await ctx.prisma.product.findUniqueOrThrow({ where: { id } })).quantity;

  const clearEvents = () => {
    received.stock = [];
    received.invoices = [];
  };

  const noSaleWritten = async () => {
    expect(await ctx.prisma.invoice.count({ where: { type: 'SALE' } })).toBe(0);
    expect(await ctx.prisma.invoiceLine.count()).toBe(0);
    expect(
      await ctx.prisma.stockMovement.count({ where: { reason: 'SALE' } }),
    ).toBe(0);
  };

  it('sells: stock goes down per line, priced from the catalogue', async () => {
    const keyboard = await createProduct('KB-1', 45, 89.99, 'Keyboard');
    const mouse = await createProduct('MS-1', 120, 24.5, 'Mouse');

    const invoice = (
      await sell({
        customerName: '  Al Noor Trading  ',
        lines: [
          { productId: keyboard.id, quantity: 2 },
          { productId: mouse.id, quantity: 3 },
        ],
      }).expect(201)
    ).body as InvoiceResponse;

    expect(invoice).toMatchObject({
      invoiceNumber: number(1),
      type: 'SALE',
      status: 'NOT_SENT',
      counterpartyName: 'Al Noor Trading',
      subtotal: '253.48', // 2 × 89.99 + 3 × 24.50
      taxAmount: '0.00',
      total: '253.48',
    });
    expect(invoice.lines).toEqual([
      expect.objectContaining({
        lineNumber: 1,
        sku: 'KB-1',
        description: 'Keyboard',
        quantity: 2,
        unitPrice: '89.99',
        lineTotal: '179.98',
      }),
      expect.objectContaining({
        lineNumber: 2,
        sku: 'MS-1',
        description: 'Mouse',
        quantity: 3,
        unitPrice: '24.50',
        lineTotal: '73.50',
      }),
    ]);
    expect(await quantityOf(keyboard.id)).toBe(43);
    expect(await quantityOf(mouse.id)).toBe(117);

    const movements = await ctx.prisma.stockMovement.findMany({
      where: { invoiceId: invoice.id },
    });
    expect(movements).toHaveLength(2);
    expect(
      movements.every((m) => m.reason === 'SALE' && m.type === 'OUT'),
    ).toBe(true);
  });

  it('can sell the exact remaining stock (down to 0)', async () => {
    const p = await createProduct('EX-1', 3, 10);

    await sell({
      customerName: 'Buyer',
      lines: [{ productId: p.id, quantity: 3 }],
    }).expect(201);

    expect(await quantityOf(p.id)).toBe(0);
  });

  it('snapshots the price: a later price change does not alter the invoice', async () => {
    const p = await createProduct('PR-1', 10, 50);
    const invoice = (
      await sell({
        customerName: 'Buyer',
        lines: [{ productId: p.id, quantity: 1 }],
      }).expect(201)
    ).body as InvoiceResponse;

    await ctx.prisma.product.update({
      where: { id: p.id },
      data: { price: '75.00' },
    });

    const line = await ctx.prisma.invoiceLine.findFirstOrThrow({
      where: { invoiceId: invoice.id },
    });
    expect(line.unitPrice.toFixed(2)).toBe('50.00');
  });

  describe('all-or-nothing', () => {
    it('3 lines, 1 short → 409 listing that SKU; nothing changes and no number is used', async () => {
      const a = await createProduct('A-1', 10, 1);
      const b = await createProduct('B-1', 2, 1);
      const c = await createProduct('C-1', 10, 1);
      clearEvents();

      const res = await sell({
        customerName: 'Buyer',
        lines: [
          { productId: a.id, quantity: 5 },
          { productId: b.id, quantity: 5 },
          { productId: c.id, quantity: 5 },
        ],
      }).expect(409);

      expect(res.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Insufficient stock',
        shortages: [
          { productId: b.id, sku: 'B-1', requested: 5, available: 2 },
        ],
      });
      expect(await quantityOf(a.id)).toBe(10); // A and C were applied, then rolled back
      expect(await quantityOf(b.id)).toBe(2);
      expect(await quantityOf(c.id)).toBe(10);
      await noSaleWritten();
      expect(received.stock).toHaveLength(0);
      expect(received.invoices).toHaveLength(0);

      const next = (
        await sell({
          customerName: 'Buyer',
          lines: [{ productId: a.id, quantity: 1 }],
        }).expect(201)
      ).body as InvoiceResponse;
      expect(next.invoiceNumber).toBe(number(1));
    });

    it('lists EVERY short line (not just the first), in the order submitted', async () => {
      const a = await createProduct('A-2', 1, 1);
      const b = await createProduct('B-2', 10, 1);
      const c = await createProduct('C-2', 0, 1);

      const res = await sell({
        customerName: 'Buyer',
        lines: [
          { productId: c.id, quantity: 4 },
          { productId: b.id, quantity: 4 },
          { productId: a.id, quantity: 4 },
        ],
      }).expect(409);

      expect((res.body as ShortageBody).shortages).toEqual([
        { productId: c.id, sku: 'C-2', requested: 4, available: 0 },
        { productId: a.id, sku: 'A-2', requested: 4, available: 1 },
      ]);
      await noSaleWritten();
    });
  });

  describe('errors', () => {
    let productId: string;
    beforeEach(async () => {
      productId = (await createProduct('V-1', 10, 1)).id;
    });

    it('unknown product → 404 listing it', async () => {
      const res = await sell({
        customerName: 'Buyer',
        lines: [
          { productId: UNKNOWN_ID, quantity: 1 },
          { productId, quantity: 1 },
        ],
      }).expect(404);

      expect(res.body).toMatchObject({
        message: 'Products not found',
        productIds: [UNKNOWN_ID],
      });
      await noSaleWritten();
      expect(await quantityOf(productId)).toBe(10);
    });

    it.each<[string, () => object]>([
      [
        'duplicate productId',
        () => ({
          customerName: 'Buyer',
          lines: [
            { productId, quantity: 1 },
            { productId, quantity: 2 },
          ],
        }),
      ],
      ['missing customerName', () => ({ lines: [{ productId, quantity: 1 }] })],
      [
        'customerName of 1 character',
        () => ({ customerName: 'B', lines: [{ productId, quantity: 1 }] }),
      ],
      ['empty lines', () => ({ customerName: 'Buyer', lines: [] })],
      [
        'quantity 0',
        () => ({ customerName: 'Buyer', lines: [{ productId, quantity: 0 }] }),
      ],
      [
        'client-supplied unitPrice (prices come from the catalogue)',
        () => ({
          customerName: 'Buyer',
          lines: [{ productId, quantity: 1, unitPrice: 0.01 }],
        }),
      ],
      [
        'unknown top-level field',
        () => ({
          customerName: 'Buyer',
          lines: [{ productId, quantity: 1 }],
          total: 1,
        }),
      ],
      [
        'future date',
        () => ({
          customerName: 'Buyer',
          date: '2999-01-01',
          lines: [{ productId, quantity: 1 }],
        }),
      ],
    ])('%s → 400', async (_case, body) => {
      await sell(body()).expect(400);
      await noSaleWritten();
      expect(await quantityOf(productId)).toBe(10);
    });
  });

  it('publishes stock.updated per product and invoice.created after a successful sale', async () => {
    const a = await createProduct('EV-A', 5, 2);
    const b = await createProduct('EV-B', 5, 3);
    clearEvents();

    const invoice = (
      await sell({
        customerName: 'Buyer',
        lines: [
          { productId: a.id, quantity: 1 },
          { productId: b.id, quantity: 2 },
        ],
      }).expect(201)
    ).body as InvoiceResponse;

    expect(received.stock.map((e) => [e.sku, e.quantity]).sort()).toEqual([
      ['EV-A', 4],
      ['EV-B', 3],
    ]);
    expect(received.invoices).toEqual([
      expect.objectContaining({
        id: invoice.id,
        type: 'SALE',
        total: '8.00',
        counterpartyName: 'Buyer',
      }),
    ]);
  });

  describe('concurrency', () => {
    it('parallel sales on a low-stock product: never negative, gap-free numbers', async () => {
      const p = await createProduct('HOT-1', 10, 5);

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          sell({
            customerName: 'Buyer',
            lines: [{ productId: p.id, quantity: 3 }],
          }),
        ),
      );

      expect(results.map((r) => r.status).sort()).toEqual([
        201, 201, 201, 409, 409,
      ]);
      expect(await quantityOf(p.id)).toBe(1);
      const numbers = results
        .filter((r) => r.status === 201)
        .map((r) => (r.body as InvoiceResponse).invoiceNumber)
        .sort();
      expect(numbers).toEqual([number(1), number(2), number(3)]); // rejected sales used no number
      expect(
        await ctx.prisma.stockMovement.count({ where: { reason: 'SALE' } }),
      ).toBe(3);
    });

    // Same-type invoices are already serialized by their numbering lock, so the
    // real deadlock risk is a PURCHASE and a SALE (different sequences) locking
    // the same products in opposite orders. Sorted lock order prevents it.
    it('no deadlock when parallel purchases and sales touch the same products in opposite orders', async () => {
      const a = await createProduct('DL-A', 1000, 1);
      const b = await createProduct('DL-B', 1000, 1);

      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          i % 2 === 0
            ? http()
                .post('/purchases')
                .send({
                  supplierName: 'Acme',
                  lines: [
                    { productId: a.id, quantity: 1, unitCost: 1 },
                    { productId: b.id, quantity: 1, unitCost: 1 },
                  ],
                })
            : sell({
                customerName: 'Buyer',
                lines: [
                  { productId: b.id, quantity: 1 },
                  { productId: a.id, quantity: 1 },
                ],
              }),
        ),
      );

      expect(results.map((r) => r.status)).toEqual(Array(20).fill(201));
      expect(await quantityOf(a.id)).toBe(1000); // +10 purchased, -10 sold
      expect(await quantityOf(b.id)).toBe(1000);
    });
  });

  it('purchase then sale share nothing but products: separate PUR/SAL sequences', async () => {
    const p = await createProduct('SEQ-1', 0, 10);

    const purchase = (
      await http()
        .post('/purchases')
        .send({
          supplierName: 'Acme',
          lines: [{ productId: p.id, quantity: 5, unitCost: 6 }],
        })
        .expect(201)
    ).body as InvoiceResponse;
    const sale = (
      await sell({
        customerName: 'Buyer',
        lines: [{ productId: p.id, quantity: 2 }],
      }).expect(201)
    ).body as InvoiceResponse;

    expect(purchase.invoiceNumber).toBe(`PUR-${year}-0001`);
    expect(sale.invoiceNumber).toBe(number(1));
    expect(sale.lines[0].unitPrice).toBe('10.00'); // catalogue price, not the purchase cost
    expect(await quantityOf(p.id)).toBe(3);
  });
});
