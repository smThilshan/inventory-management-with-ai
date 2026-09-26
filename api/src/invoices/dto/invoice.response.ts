import { ApiProperty } from '@nestjs/swagger';
import { formatCalendarDate } from '../../common/calendar-date';
import { formatMoney } from '../../common/money';
import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  Prisma,
} from '../../generated/prisma/client';
import {
  StockMovementResponse,
  toStockMovementResponse,
} from '../../stock-movements/dto/stock-movement.response';

export type InvoiceWithLines = Prisma.InvoiceGetPayload<{
  include: { lines: true };
}>;
export type InvoiceWithDetails = Prisma.InvoiceGetPayload<{
  include: { lines: true; movements: true };
}>;

const money = (example: string) => ({
  example,
  pattern: '^\\d+\\.\\d{2}$',
  description: 'Decimal string with exactly 2 places; never a float.',
});

export class InvoiceLineResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  lineNumber: number;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({
    example: 'Mechanical Keyboard',
    description: 'Product name at the time of the invoice (snapshot).',
  })
  description: string;

  @ApiProperty({ example: 'KB-MECH-001', description: 'SKU snapshot.' })
  sku: string;

  @ApiProperty({ type: 'integer', minimum: 1, example: 10 })
  quantity: number;

  @ApiProperty(money('45.00'))
  unitPrice: string;

  @ApiProperty(money('450.00'))
  lineTotal: string;
}

/** Invoice header fields: used by the list endpoint. */
export class InvoiceSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'PUR-2026-0001' })
  invoiceNumber: string;

  @ApiProperty({ enum: InvoiceType, enumName: 'InvoiceType' })
  type: InvoiceType;

  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  status: InvoiceStatus;

  @ApiProperty({
    example: 'Acme Supplies LLC',
    description: 'Supplier for a PURCHASE, customer for a SALE.',
  })
  counterpartyName: string;

  @ApiProperty({
    example: 'Demo Trading LLC',
    description: 'Our company as printed on the invoice (snapshot).',
  })
  companyName: string;

  @ApiProperty({
    example: 'Office 101, Business Bay, Dubai, United Arab Emirates',
    description: 'Our address as printed on the invoice (snapshot).',
  })
  companyAddress: string;

  @ApiProperty({ format: 'date', example: '2026-09-25' })
  date: string;

  @ApiProperty({ format: 'date', example: '2026-10-25' })
  dueDate: string;

  @ApiProperty({ example: 'AED', description: 'ISO 4217 code.' })
  currency: string;

  @ApiProperty(money('450.00'))
  subtotal: string;

  @ApiProperty({
    example: '0.05',
    description: 'Decimal fraction (0.05 = 5%). 0 when tax is disabled.',
  })
  taxRate: string;

  @ApiProperty(money('22.50'))
  taxAmount: string;

  @ApiProperty(money('472.50'))
  total: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** An invoice with its lines: returned when a purchase or sale is created. */
export class InvoiceResponse extends InvoiceSummaryResponse {
  @ApiProperty({
    type: [InvoiceLineResponse],
    description: 'In line-number order.',
  })
  lines: InvoiceLineResponse[];
}

/** Everything about one invoice, including the stock movements it caused. */
export class InvoiceDetailResponse extends InvoiceResponse {
  @ApiProperty({
    type: [StockMovementResponse],
    description: 'One stock movement per line, linked to this invoice.',
  })
  movements: StockMovementResponse[];
}

export class InvoicePageResponse {
  @ApiProperty({ type: [InvoiceSummaryResponse], description: 'Newest first.' })
  items: InvoiceSummaryResponse[];

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Pass as `cursor` for the next page; null on the last page.',
  })
  nextCursor: string | null;
}

// Fields listed explicitly so new columns are never exposed by accident.
export function toInvoiceSummary(invoice: Invoice): InvoiceSummaryResponse {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    status: invoice.status,
    counterpartyName: invoice.counterpartyName,
    companyName: invoice.companyName,
    companyAddress: invoice.companyAddress,
    date: formatCalendarDate(invoice.date),
    dueDate: formatCalendarDate(invoice.dueDate),
    currency: invoice.currency,
    subtotal: formatMoney(invoice.subtotal),
    taxRate: invoice.taxRate.toString(),
    taxAmount: formatMoney(invoice.taxAmount),
    total: formatMoney(invoice.total),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export function toInvoiceResponse(invoice: InvoiceWithLines): InvoiceResponse {
  return {
    ...toInvoiceSummary(invoice),
    lines: [...invoice.lines]
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map((line) => ({
        id: line.id,
        lineNumber: line.lineNumber,
        productId: line.productId,
        description: line.description,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: formatMoney(line.unitPrice),
        lineTotal: formatMoney(line.lineTotal),
      })),
  };
}

export function toInvoiceDetailResponse(
  invoice: InvoiceWithDetails,
): InvoiceDetailResponse {
  return {
    ...toInvoiceResponse(invoice),
    movements: invoice.movements.map(toStockMovementResponse),
  };
}
