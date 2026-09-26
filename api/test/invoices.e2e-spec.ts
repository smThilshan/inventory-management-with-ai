import { ConfigService } from '@nestjs/config';
import { existsSync, writeFileSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { todayIn } from '../src/common/calendar-date';
import { EnvironmentVariables } from '../src/config/env.validation';
import {
  InvoiceDetailResponse,
  InvoicePageResponse,
  InvoiceResponse,
} from '../src/invoices/dto/invoice.response';
import { InvoiceSettings } from '../src/invoices/invoice-settings';
import { ProductResponse } from '../src/products/dto/product.response';
import { extractPdfText } from './utils/pdf-text';
import { createTestApp, resetState, TestContext } from './utils/test-app';

const UNKNOWN_ID = '01990000-0000-7000-8000-00000000000a';
const POLL_MS = 50;
const POLL_TIMEOUT_MS = 3_000;

/** Binary-safe supertest body parser for PDFs. */
const asBuffer = (
  res: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

async function waitFor(check: () => Promise<boolean> | boolean): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (!(await check())) {
    if (Date.now() > deadline)
      throw new Error('Timed out waiting for condition');
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

describe('Invoices (e2e)', () => {
  let ctx: TestContext;
  let storageDir: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    storageDir = resolve(ctx.app.get(InvoiceSettings).storageDir);
  });

  beforeEach(async () => {
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const http = () => request(ctx.app.getHttpServer());

  const createProduct = async (sku: string, quantity: number, price = 10) =>
    (
      await http()
        .post('/products')
        .send({ name: `Product ${sku}`, sku, quantity, price })
        .expect(201)
    ).body as ProductResponse;

  const purchase = async (productId: string, supplierName = 'Acme Supplies') =>
    (
      await http()
        .post('/purchases')
        .send({
          supplierName,
          lines: [{ productId, quantity: 5, unitCost: 4.5 }],
        })
        .expect(201)
    ).body as InvoiceResponse;

  const sale = async (productId: string) =>
    (
      await http()
        .post('/sales')
        .send({
          customerName: 'Al Noor Trading',
          lines: [{ productId, quantity: 1 }],
        })
        .expect(201)
    ).body as InvoiceResponse;

  const getPdf = (id: string) =>
    http().get(`/invoices/${id}/pdf`).buffer(true).parse(asBuffer);

  const storedFiles = async () =>
    existsSync(storageDir)
      ? (await readdir(storageDir)).filter((f) => f.endsWith('.pdf'))
      : [];

  describe('GET /invoices', () => {
    let p: ProductResponse;
    let invoices: InvoiceResponse[];

    beforeEach(async () => {
      p = await createProduct('LIST-1', 100);
      invoices = [await purchase(p.id), await sale(p.id), await purchase(p.id)];
    });

    it('lists newest first, without lines', async () => {
      const page = (await http().get('/invoices').expect(200))
        .body as InvoicePageResponse;

      expect(page.items.map((i) => i.invoiceNumber)).toEqual(
        [...invoices].reverse().map((i) => i.invoiceNumber),
      );
      expect(page.nextCursor).toBeNull();
      expect(page.items[0]).not.toHaveProperty('lines');
    });

    it.each([
      ['type=SALE', 1],
      ['type=PURCHASE', 2],
      ['status=NOT_SENT', 3],
      ['status=POSTED', 0],
      ['type=SALE&status=NOT_SENT', 1],
    ])('filters by %s', async (query, expected) => {
      const page = (await http().get(`/invoices?${query}`).expect(200))
        .body as InvoicePageResponse;

      expect(page.items).toHaveLength(expected);
    });

    it('paginates with nextCursor', async () => {
      const first = (await http().get('/invoices?limit=2').expect(200))
        .body as InvoicePageResponse;
      const second = (
        await http()
          .get(`/invoices?limit=2&cursor=${first.nextCursor}`)
          .expect(200)
      ).body as InvoicePageResponse;

      expect(first.items).toHaveLength(2);
      expect(second.items.map((i) => i.id)).toEqual([invoices[0].id]);
      expect(second.nextCursor).toBeNull();
    });

    it.each([
      'type=REFUND',
      'status=PAID',
      'limit=0',
      'cursor=abc',
      'sort=total',
    ])('rejects %s with 400', async (query) => {
      await http().get(`/invoices?${query}`).expect(400);
    });
  });

  describe('GET /invoices/:id', () => {
    it('returns the invoice with lines and its linked stock movements', async () => {
      const a = await createProduct('DET-A', 0);
      const b = await createProduct('DET-B', 0);
      const created = (
        await http()
          .post('/purchases')
          .send({
            supplierName: 'Acme',
            lines: [
              { productId: a.id, quantity: 2, unitCost: 1 },
              { productId: b.id, quantity: 3, unitCost: 1 },
            ],
          })
          .expect(201)
      ).body as InvoiceResponse;

      const detail = (await http().get(`/invoices/${created.id}`).expect(200))
        .body as InvoiceDetailResponse;

      expect(detail).toMatchObject({
        id: created.id,
        invoiceNumber: created.invoiceNumber,
        companyName: 'Test Company LLC',
        companyAddress: '1 Test Street, Dubai, United Arab Emirates',
      });
      expect(detail.lines.map((l) => l.sku)).toEqual(['DET-A', 'DET-B']);
      expect(detail.movements).toHaveLength(2);
      expect(
        detail.movements.every(
          (m) => m.reason === 'PURCHASE' && m.invoiceId === created.id,
        ),
      ).toBe(true);
    });

    it('404 for an unknown invoice, 400 for a malformed id', async () => {
      await http().get(`/invoices/${UNKNOWN_ID}`).expect(404);
      await http().get('/invoices/abc').expect(400);
    });
  });

  describe('GET /invoices/:id/pdf', () => {
    it('serves an inline, text-based PDF named after the invoice number', async () => {
      const p = await createProduct('PDF-1', 0);
      const invoice = await purchase(p.id, 'Gulf Tech Distributors');

      const res = await getPdf(invoice.id).expect(200);
      const body = res.body as Buffer;

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        `inline; filename="${invoice.invoiceNumber}.pdf"`,
      );
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
      const text = extractPdfText(body);
      expect(text).toContain('PURCHASE INVOICE');
      expect(text).toContain(`Invoice No: ${invoice.invoiceNumber}`);
      expect(text).toContain('Gulf Tech Distributors');
      expect(text).toContain('Test Company LLC'); // Bill To (from the invoice snapshot)
      expect(text).toContain(`AED ${invoice.total}`);
    });

    it('sale PDFs say SALES INVOICE and bill the customer', async () => {
      const p = await createProduct('PDF-2', 10);
      const invoice = await sale(p.id);

      const text = extractPdfText(
        (await getPdf(invoice.id).expect(200)).body as Buffer,
      );

      expect(text).toContain('SALES INVOICE');
      expect(text.indexOf('Test Company LLC')).toBeLessThan(
        text.indexOf('Al Noor Trading'),
      );
    });

    it('is generated into storage after commit', async () => {
      const p = await createProduct('PDF-3', 0);
      const invoice = await purchase(p.id);

      await waitFor(async () => (await storedFiles()).length === 1);
      expect(await storedFiles()).toEqual([
        `${invoice.invoiceNumber}_${invoice.id}.pdf`,
      ]);
    });

    it('is regenerated on demand when the file is missing, byte-for-byte identical', async () => {
      const p = await createProduct('PDF-4', 0);
      const invoice = await purchase(p.id);
      const original = (await getPdf(invoice.id).expect(200)).body as Buffer;
      const file = join(
        storageDir,
        `${invoice.invoiceNumber}_${invoice.id}.pdf`,
      );
      await waitFor(() => existsSync(file));

      await rm(file);
      const regenerated = (await getPdf(invoice.id).expect(200)).body as Buffer;

      expect(regenerated.equals(original)).toBe(true);
      expect(existsSync(file)).toBe(true);
    });

    it('404 for an unknown invoice', async () => {
      await http().get(`/invoices/${UNKNOWN_ID}/pdf`).expect(404);
    });
  });

  it('GET /invoicing/settings exposes what clients need to preview totals', async () => {
    const res = await http().get('/invoicing/settings').expect(200);

    expect(res.body).toEqual({
      taxRate: '0',
      currency: 'AED',
      dueDays: 30,
      today: todayIn(ctx.app.get(InvoiceSettings).timeZone),
    });
  });

  describe('when PDF storage is unavailable', () => {
    let brokenCtx: TestContext;

    beforeAll(async () => {
      // A regular file where the storage directory should be: every write fails.
      const blocker = resolve(storageDir, '..', 'not-a-directory');
      writeFileSync(blocker, '');
      brokenCtx = await createTestApp((builder) =>
        builder.overrideProvider(InvoiceSettings).useFactory({
          factory: (config: ConfigService<EnvironmentVariables, true>) =>
            Object.assign(new InvoiceSettings(config), {
              storageDir: join(blocker, 'invoices'),
            }),
          inject: [ConfigService],
        }),
      );
    });

    afterAll(async () => {
      await brokenCtx.app.close();
      await rm(resolve(storageDir, '..', 'not-a-directory'), { force: true });
    });

    it('still creates the invoice and still serves the PDF', async () => {
      await resetState(brokenCtx);
      const server = () => request(brokenCtx.app.getHttpServer());
      const p = (
        await server()
          .post('/products')
          .send({ name: 'X', sku: 'BROKEN-1', price: 1 })
          .expect(201)
      ).body as ProductResponse;

      const invoice = (
        await server()
          .post('/purchases')
          .send({
            supplierName: 'Acme',
            lines: [{ productId: p.id, quantity: 1, unitCost: 1 }],
          })
          .expect(201)
      ).body as InvoiceResponse;
      const res = await server()
        .get(`/invoices/${invoice.id}/pdf`)
        .buffer(true)
        .parse(asBuffer)
        .expect(200);

      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    });
  });
});
