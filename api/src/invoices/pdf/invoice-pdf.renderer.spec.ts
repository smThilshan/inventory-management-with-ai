import { extractPdfText, pageCount } from '../../../test/utils/pdf-text';
import { calculateInvoiceTotals } from '../../common/money';
import { InvoiceType, Prisma } from '../../generated/prisma/client';
import type { InvoiceWithLines } from '../dto/invoice.response';
import { renderInvoicePdf } from './invoice-pdf.renderer';

type LineSpec = [
  description: string,
  sku: string,
  quantity: number,
  unitPrice: string,
];

function invoice(
  type: InvoiceType,
  options: { taxRate?: string; lines?: LineSpec[] } = {},
): InvoiceWithLines {
  const taxRate = options.taxRate ?? '0';
  const lines: LineSpec[] = options.lines ?? [
    ['Mechanical Keyboard', 'KB-MECH-001', 10, '45.00'],
    ['Wireless Mouse', 'MS-WL-002', 25, '12.50'],
  ];
  const totals = calculateInvoiceTotals(
    lines.map(([, , quantity, unitPrice]) => ({ quantity, unitPrice })),
    taxRate,
  );
  const createdAt = new Date('2026-09-25T10:00:00.000Z');
  return {
    id: 'invoice-1',
    invoiceNumber:
      type === InvoiceType.PURCHASE ? 'PUR-2026-0001' : 'SAL-2026-0001',
    type,
    status: 'NOT_SENT',
    counterpartyName:
      type === InvoiceType.PURCHASE
        ? 'Gulf Tech Distributors'
        : 'Al Noor Trading',
    companyName: 'Demo Trading LLC',
    companyAddress: 'Office 101, Business Bay, Dubai',
    date: new Date('2026-09-25T00:00:00.000Z'),
    dueDate: new Date('2026-10-25T00:00:00.000Z'),
    currency: 'AED',
    subtotal: totals.subtotal,
    taxRate: new Prisma.Decimal(taxRate),
    taxAmount: totals.taxAmount,
    total: totals.total,
    createdAt,
    updatedAt: createdAt,
    lines: lines.map(([description, sku, quantity], index) => ({
      id: `line-${index}`,
      invoiceId: 'invoice-1',
      lineNumber: index + 1,
      productId: `product-${index}`,
      description,
      sku,
      quantity,
      unitPrice: totals.lines[index].unitPrice,
      lineTotal: totals.lines[index].lineTotal,
    })),
  };
}

const textOf = async (data: InvoiceWithLines) =>
  extractPdfText(await renderInvoicePdf(data));

/** Asserts the fragments appear in this order in the extracted text. */
function expectInOrder(text: string, fragments: string[]): void {
  let from = 0;
  for (const fragment of fragments) {
    const at = text.indexOf(fragment, from);
    expect({ fragment, found: at >= 0 }).toEqual({ fragment, found: true });
    from = at + fragment.length;
  }
}

describe('renderInvoicePdf', () => {
  it('produces a real PDF, byte-for-byte identical for the same invoice, whenever it is rendered', async () => {
    // Real timers keep running (pdfkit streams use them); only the clock moves,
    // so "now" differs between the two renders by a year.
    jest.useFakeTimers({
      advanceTimers: true,
      now: new Date('2026-09-25T10:00:00Z'),
    });
    try {
      const first = await renderInvoicePdf(invoice(InvoiceType.PURCHASE));
      jest.setSystemTime(new Date('2027-09-25T10:00:00Z'));
      const second = await renderInvoicePdf(invoice(InvoiceType.PURCHASE));

      expect(first.subarray(0, 5).toString()).toBe('%PDF-');
      expect(first.equals(second)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('purchase: title, labelled fields, supplier bills us', async () => {
    const text = await textOf(invoice(InvoiceType.PURCHASE));

    expectInOrder(text, [
      'PURCHASE INVOICE',
      'Invoice No: PUR-2026-0001',
      'Invoice Date: 2026-09-25',
      'Due Date: 2026-10-25',
      'Currency: AED',
      'Bill From:',
      'Gulf Tech Distributors',
      'Bill To:',
      'Demo Trading LLC',
      'Office 101, Business Bay, Dubai',
    ]);
  });

  it('sale: we bill the customer', async () => {
    const text = await textOf(invoice(InvoiceType.SALE));

    expectInOrder(text, [
      'SALES INVOICE',
      'Invoice No: SAL-2026-0001',
      'Bill From:',
      'Demo Trading LLC',
      'Bill To:',
      'Al Noor Trading',
    ]);
  });

  it('has a table with #, Description, SKU, Qty, Unit Price, Amount and the lines in order', async () => {
    const text = await textOf(invoice(InvoiceType.PURCHASE));

    expectInOrder(text, [
      '#',
      'Description',
      'SKU',
      'Qty',
      'Unit Price',
      'Amount',
      '1',
      'Mechanical Keyboard',
      'KB-MECH-001',
      '10',
      '45.00',
      '450.00',
      '2',
      'Wireless Mouse',
      'MS-WL-002',
      '25',
      '12.50',
      '312.50',
      'Subtotal:',
      'AED 762.50',
      'Total:',
      'AED 762.50',
    ]);
  });

  it('hides the tax row when tax is disabled (0%)', async () => {
    const text = await textOf(invoice(InvoiceType.PURCHASE, { taxRate: '0' }));

    expect(text).not.toContain('Tax');
  });

  it.each([
    ['0.05', 'Tax (5%):', 'AED 38.13', 'AED 800.63'],
    ['0.075', 'Tax (7.5%):', 'AED 57.19', 'AED 819.69'],
  ])('shows the tax row at %s', async (rate, label, tax, total) => {
    const text = await textOf(invoice(InvoiceType.PURCHASE, { taxRate: rate }));

    expectInOrder(text, [
      'Subtotal:',
      'AED 762.50',
      label,
      tax,
      'Total:',
      total,
    ]);
  });

  it('spans pages, repeats the table header and numbers every page', async () => {
    const lines = Array.from({ length: 60 }, (_, i): LineSpec => [
      `Item ${i + 1}`,
      `SKU-${i + 1}`,
      1,
      '1.00',
    ]);
    const pdf = await renderInvoicePdf(
      invoice(InvoiceType.PURCHASE, { lines }),
    );
    const text = extractPdfText(pdf);

    expect(pageCount(pdf)).toBe(2);
    expect(text.match(/Unit Price/g)).toHaveLength(2);
    expectInOrder(text, [
      'Item 1',
      'PUR-2026-0001 - Page 1 of 2',
      'Unit Price',
      'Item 60',
      'Total:',
      'AED 60.00',
      'PUR-2026-0001 - Page 2 of 2',
    ]);
  });
});
