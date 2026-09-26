import { InvoiceType } from '../generated/prisma/client';

export const INVOICE_NUMBER_PREFIX: Readonly<Record<InvoiceType, string>> = {
  PURCHASE: 'PUR',
  SALE: 'SAL',
};

/** Minimum digits; numbers beyond 9999 in a year simply grow (never truncated). */
const SEQUENCE_PAD_LENGTH = 4;

/** e.g. PUR-2026-0001 */
export function formatInvoiceNumber(
  type: InvoiceType,
  year: number,
  sequence: number,
): string {
  const padded = String(sequence).padStart(SEQUENCE_PAD_LENGTH, '0');
  return `${INVOICE_NUMBER_PREFIX[type]}-${year}-${padded}`;
}

/**
 * Invoice dates are calendar dates stored at UTC midnight (Postgres DATE), so
 * the numbering year is the UTC year: never shifted by the server's timezone.
 */
export const invoiceYear = (date: Date): number => date.getUTCFullYear();
