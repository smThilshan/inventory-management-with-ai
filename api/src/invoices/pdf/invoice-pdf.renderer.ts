import PDFDocument from 'pdfkit';
import { formatCalendarDate } from '../../common/calendar-date';
import { formatMoney } from '../../common/money';
import { InvoiceType, Prisma } from '../../generated/prisma/client';
import type { InvoiceWithLines } from '../dto/invoice.response';

/*
 * Designed to be read by people AND by an LLM (Task 2 extracts these PDFs):
 * standard fonts, black text on white, real text (no images), explicit
 * "Label: value" lines, blocks stacked vertically (side-by-side columns get
 * interleaved by text extractors), plain amounts without thousands separators,
 * and the invoice number + page count on every page.
 */

const FONT = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const MARGIN = 50;
const A4_WIDTH = 595.28;
const CONTENT_WIDTH = A4_WIDTH - 2 * MARGIN;
const FOOTER_HEIGHT = 20;
const CELL_PADDING = 6;
const ROW_PADDING = 6;
const TABLE_FONT_SIZE = 9;
const BODY_FONT_SIZE = 10;

const TITLES: Readonly<Record<InvoiceType, string>> = {
  PURCHASE: 'PURCHASE INVOICE',
  SALE: 'SALES INVOICE',
};

interface Column {
  header: string;
  width: number;
  align: 'left' | 'right';
}

// Widths sum to CONTENT_WIDTH (495pt on A4 with 50pt margins).
const COLUMNS: readonly Column[] = [
  { header: '#', width: 25, align: 'left' },
  { header: 'Description', width: 185, align: 'left' },
  { header: 'SKU', width: 90, align: 'left' },
  { header: 'Qty', width: 45, align: 'right' },
  { header: 'Unit Price', width: 75, align: 'right' },
  { header: 'Amount', width: 75.28, align: 'right' },
];

interface Party {
  name: string;
  address?: string;
}

/** Renders an invoice to PDF bytes. Pure and deterministic: same invoice → same bytes. */
export function renderInvoicePdf(invoice: InvoiceWithLines): Promise<Buffer> {
  const title = TITLES[invoice.type];
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true, // needed to write "Page X of Y" once the page count is known
    info: {
      Title: `${title} ${invoice.invoiceNumber}`,
      Author: invoice.companyName,
      Subject: `${title} ${invoice.invoiceNumber}`,
      // Fixed (not "now"): pdfkit derives the document ID from the metadata,
      // so this is what makes the output byte-for-byte reproducible.
      CreationDate: invoice.createdAt,
      ModDate: invoice.createdAt,
    },
  });

  const done = collect(doc);
  drawHeader(doc, invoice, title);
  drawTable(doc, invoice);
  drawTotals(doc, invoice);
  drawFooters(doc, invoice.invoiceNumber);
  doc.end();
  return done;
}

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  invoice: InvoiceWithLines,
  title: string,
): void {
  doc.font(FONT_BOLD).fontSize(20).text(title, MARGIN, MARGIN);
  doc.moveDown(0.8);

  doc.font(FONT).fontSize(BODY_FONT_SIZE);
  labelled(doc, 'Invoice No', invoice.invoiceNumber);
  labelled(doc, 'Invoice Date', formatCalendarDate(invoice.date));
  labelled(doc, 'Due Date', formatCalendarDate(invoice.dueDate));
  labelled(doc, 'Currency', invoice.currency);
  doc.moveDown(0.8);

  const company: Party = {
    name: invoice.companyName,
    address: invoice.companyAddress,
  };
  const counterparty: Party = { name: invoice.counterpartyName };
  // A purchase is billed by the supplier to us; a sale is billed by us to the customer.
  const [from, to] =
    invoice.type === InvoiceType.PURCHASE
      ? [counterparty, company]
      : [company, counterparty];
  party(doc, 'Bill From', from);
  party(doc, 'Bill To', to);
  doc.moveDown(0.8);
}

function labelled(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc.font(FONT_BOLD).text(`${label}: `, { continued: true });
  doc.font(FONT).text(value);
}

function party(doc: PDFKit.PDFDocument, label: string, value: Party): void {
  doc.font(FONT_BOLD).text(`${label}:`);
  doc.font(FONT).text(value.name, { width: CONTENT_WIDTH });
  if (value.address) {
    doc.text(value.address, { width: CONTENT_WIDTH });
  }
  doc.moveDown(0.5);
}

const pageBottom = (doc: PDFKit.PDFDocument): number =>
  doc.page.height - MARGIN - FOOTER_HEIGHT;

/** Draws one row; returns its height. */
function drawRow(
  doc: PDFKit.PDFDocument,
  y: number,
  cells: string[],
  font: string,
): number {
  doc.font(font).fontSize(TABLE_FONT_SIZE);
  const height = rowHeight(doc, cells, font);
  let x = MARGIN;
  COLUMNS.forEach((column, i) => {
    doc.text(cells[i], x + CELL_PADDING / 2, y + ROW_PADDING / 2, {
      width: column.width - CELL_PADDING,
      align: column.align,
    });
    x += column.width;
  });
  return height;
}

function rowHeight(
  doc: PDFKit.PDFDocument,
  cells: string[],
  font: string,
): number {
  doc.font(font).fontSize(TABLE_FONT_SIZE);
  const tallest = Math.max(
    ...COLUMNS.map((column, i) =>
      doc.heightOfString(cells[i], { width: column.width - CELL_PADDING }),
    ),
  );
  return tallest + ROW_PADDING;
}

const HEADER_RULE_GAP = 3;

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  const height = drawRow(
    doc,
    y,
    COLUMNS.map((column) => column.header),
    FONT_BOLD,
  );
  rule(doc, y + height);
  return y + height + HEADER_RULE_GAP;
}

function rule(doc: PDFKit.PDFDocument, y: number): void {
  doc
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_WIDTH, y)
    .lineWidth(0.5)
    .strokeColor('black')
    .stroke();
}

/** Lines in order; the header repeats on every page the table spans. */
function drawTable(doc: PDFKit.PDFDocument, invoice: InvoiceWithLines): void {
  let y = drawTableHeader(doc, doc.y);
  const lines = [...invoice.lines].sort((a, b) => a.lineNumber - b.lineNumber);

  for (const line of lines) {
    const cells = [
      String(line.lineNumber),
      line.description,
      line.sku,
      String(line.quantity),
      formatMoney(line.unitPrice),
      formatMoney(line.lineTotal),
    ];
    if (y + rowHeight(doc, cells, FONT) > pageBottom(doc)) {
      doc.addPage();
      y = drawTableHeader(doc, MARGIN);
    }
    y += drawRow(doc, y, cells, FONT);
  }
  rule(doc, y);
  doc.y = y;
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: InvoiceWithLines): void {
  const rows: [string, string][] = [
    ['Subtotal', formatMoney(invoice.subtotal)],
  ];
  // Tax is disabled by default (TAX_RATE=0): no misleading "Tax (0%)" row then.
  if (!invoice.taxRate.isZero()) {
    rows.push([
      `Tax (${formatPercent(invoice.taxRate)}%)`,
      formatMoney(invoice.taxAmount),
    ]);
  }
  rows.push(['Total', formatMoney(invoice.total)]);

  const lineHeight = 18;
  let y = doc.y + 12;
  if (y + rows.length * lineHeight > pageBottom(doc)) {
    doc.addPage();
    y = MARGIN;
  }

  const labelX = MARGIN + CONTENT_WIDTH - 250;
  rows.forEach(([label, amount], index) => {
    const font = index === rows.length - 1 ? FONT_BOLD : FONT;
    doc.font(font).fontSize(BODY_FONT_SIZE);
    doc.text(`${label}:`, labelX, y, { width: 140, align: 'right' });
    doc.text(`${invoice.currency} ${amount}`, labelX + 150, y, {
      width: 100,
      align: 'right',
    });
    y += lineHeight;
  });
}

/** 0.05 → "5", 0.075 → "7.5". */
function formatPercent(rate: Prisma.Decimal): string {
  return rate.times(100).toString();
}

/** "PUR-2026-0001 - Page 1 of 2" on every page, so each page stands on its own. */
function drawFooters(doc: PDFKit.PDFDocument, invoiceNumber: string): void {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise trigger an automatic new page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(FONT)
      .fontSize(8)
      .text(
        `${invoiceNumber} - Page ${i + 1} of ${count}`,
        MARGIN,
        doc.page.height - MARGIN + 10,
        { width: CONTENT_WIDTH, align: 'center' },
      );
    doc.page.margins.bottom = bottomMargin;
  }
}
