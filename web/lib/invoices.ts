import type {
  InvoiceCreatedEvent,
  InvoiceFilters,
  InvoiceSummary,
} from './types';

/** What the invoice list shows; both a list item and an `invoice.created` event have it. */
export type InvoiceRow = Pick<
  InvoiceSummary,
  'id' | 'invoiceNumber' | 'type' | 'status' | 'counterpartyName' | 'date' | 'currency' | 'total'
>;

export const matchesFilters = (row: InvoiceRow, filters: InvoiceFilters): boolean =>
  (!filters.type || row.type === filters.type) &&
  (!filters.status || row.status === filters.status);

/**
 * Union of two row lists, de-duplicated by id, newest first. Ids are UUIDv7
 * (time-ordered), so sorting by id is sorting by creation, same as the API.
 * Safe to call with overlapping data, e.g. a live event that is also in a
 * freshly fetched page.
 */
export function mergeRows(current: InvoiceRow[], incoming: InvoiceRow[]): InvoiceRow[] {
  const byId = new Map<string, InvoiceRow>();
  for (const row of [...current, ...incoming]) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

export function toRow(event: InvoiceCreatedEvent): InvoiceRow {
  const { id, invoiceNumber, type, status, counterpartyName, date, currency, total } = event;
  return { id, invoiceNumber, type, status, counterpartyName, date, currency, total };
}
