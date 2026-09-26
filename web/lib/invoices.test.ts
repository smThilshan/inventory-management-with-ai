import { invoiceCreated, invoiceSummary } from '@/test/fixtures';
import { matchesFilters, mergeRows, toRow } from './invoices';

const a = invoiceSummary({ id: '01a0-0001', invoiceNumber: 'A' });
const b = invoiceSummary({ id: '01a0-0002', invoiceNumber: 'B' });
const c = invoiceSummary({ id: '01a0-0003', invoiceNumber: 'C' });

describe('invoice list helpers', () => {
  it('mergeRows unions, de-duplicates by id and sorts newest first (UUIDv7 order)', () => {
    const merged = mergeRows([b, a], [c, b]);

    expect(merged.map((row) => row.invoiceNumber)).toEqual(['C', 'B', 'A']);
  });

  it.each([
    [{}, true],
    [{ type: 'PURCHASE' as const }, true],
    [{ type: 'SALE' as const }, false],
    [{ status: 'NOT_SENT' as const }, true],
    [{ status: 'POSTED' as const }, false],
  ])('matchesFilters(%o) → %s', (filters, expected) => {
    expect(matchesFilters(invoiceSummary(), filters)).toBe(expected);
  });

  it('toRow keeps only what the list shows', () => {
    expect(Object.keys(toRow(invoiceCreated())).sort()).toEqual(
      ['counterpartyName', 'currency', 'date', 'id', 'invoiceNumber', 'status', 'total', 'type'],
    );
  });
});
