import { InvoiceType } from '../generated/prisma/client';
import { formatInvoiceNumber, invoiceYear } from './invoice-number';

describe('formatInvoiceNumber', () => {
  it.each([
    [InvoiceType.PURCHASE, 2026, 1, 'PUR-2026-0001'],
    [InvoiceType.SALE, 2026, 1, 'SAL-2026-0001'],
    [InvoiceType.SALE, 2026, 42, 'SAL-2026-0042'],
    [InvoiceType.PURCHASE, 2027, 9999, 'PUR-2027-9999'],
    [InvoiceType.PURCHASE, 2027, 12345, 'PUR-2027-12345'], // grows, never truncated
  ])('%s %i #%i → %s', (type, year, sequence, expected) => {
    expect(formatInvoiceNumber(type, year, sequence)).toBe(expected);
  });
});

describe('invoiceYear', () => {
  it('uses the UTC year of the calendar date (no timezone shift at year end)', () => {
    expect(invoiceYear(new Date('2026-12-31T00:00:00.000Z'))).toBe(2026);
    expect(invoiceYear(new Date('2027-01-01T00:00:00.000Z'))).toBe(2027);
  });
});
