import { ApiProperty } from '@nestjs/swagger';
import { formatCalendarDate } from '../../common/calendar-date';
import { formatMoney } from '../../common/money';
import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
} from '../../generated/prisma/client';

export const INVOICE_CREATED_EVENT = 'invoice.created';

/**
 * Emitted after the invoice transaction commits. Also the hook for follow-up
 * work that must not block or roll back the invoice (PDF generation, Phase 6).
 * date/currency are included beyond the minimum so a live invoice list can
 * render a new row without refetching.
 */
export class InvoiceCreatedEvent {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'PUR-2026-0001' })
  invoiceNumber: string;

  @ApiProperty({ enum: InvoiceType, enumName: 'InvoiceType' })
  type: InvoiceType;

  @ApiProperty({ example: 'Acme Supplies LLC' })
  counterpartyName: string;

  @ApiProperty({ format: 'date', example: '2026-09-25' })
  date: string;

  @ApiProperty({ example: 'AED' })
  currency: string;

  @ApiProperty({ example: '472.50', description: '2-dp decimal string.' })
  total: string;

  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  status: InvoiceStatus;
}

export function toInvoiceCreatedEvent(invoice: Invoice): InvoiceCreatedEvent {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    counterpartyName: invoice.counterpartyName,
    date: formatCalendarDate(invoice.date),
    currency: invoice.currency,
    total: formatMoney(invoice.total),
    status: invoice.status,
  };
}
