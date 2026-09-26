'use client';

import { useId, useRef, useState } from 'react';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { PageHeader } from '@/components/PageHeader';
import { useRecentlyChanged } from '@/hooks/useRecentlyChanged';
import { useStockStream } from '@/hooks/useStockStream';
import { api } from '@/lib/api';
import { CHANGE_HIGHLIGHT_MS, INVOICES_PAGE_SIZE } from '@/lib/constants';
import { type InvoiceRow, matchesFilters, mergeRows, toRow } from '@/lib/invoices';
import type { InvoiceFilters, InvoicePage, InvoiceStatus, InvoiceType } from '@/lib/types';
import { cardClass, inputClass, labelClass, secondaryButtonClass } from '@/lib/ui';
import { StatusBadge, TypeBadge } from './Badges';

type LoadMode = 'replace' | 'append' | 'merge';

/** Invoice list with filters, "load more" and live new rows (SSE `invoice.created`). */
export function InvoicesView({ initialPage }: { initialPage: InvoicePage }) {
  const ids = useId();
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [rows, setRows] = useState<InvoiceRow[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { changedIds, markChanged } = useRecentlyChanged(CHANGE_HIGHLIGHT_MS);
  // Only the latest request may update the list (e.g. quick filter changes).
  const latestRequest = useRef(0);

  async function load(nextFilters: InvoiceFilters, mode: LoadMode, cursor?: string) {
    const request = ++latestRequest.current;
    setLoading(true);
    setLoadError(null);
    try {
      const page = await api.listInvoices({
        ...nextFilters,
        cursor,
        limit: INVOICES_PAGE_SIZE,
      });
      if (request !== latestRequest.current) return;
      setRows((current) => (mode === 'replace' ? page.items : mergeRows(current, page.items)));
      // A resync refreshes the first page but keeps any pages already loaded.
      if (mode !== 'merge') setNextCursor(page.nextCursor);
    } catch {
      if (request === latestRequest.current) {
        setLoadError('Could not load invoices. Please try again.');
      }
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }

  const status = useStockStream({
    onInvoiceCreated: (event) => {
      const row = toRow(event);
      if (!matchesFilters(row, filters)) return;
      setRows((current) => mergeRows(current, [row]));
      markChanged(row.id);
    },
    // Invoices may have been created while disconnected.
    onOpen: () => void load(filters, 'merge'),
  });

  function changeFilters(patch: InvoiceFilters) {
    const next = { ...filters, ...patch };
    setFilters(next);
    void load(next, 'replace');
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Invoices"
        description="Every purchase and sale, newest first. New invoices appear live."
        aside={<ConnectionStatus status={status} />}
      />

      <section aria-label="Filters" className="flex flex-wrap gap-4">
        <div className="w-44 space-y-1.5">
          <label htmlFor={`${ids}-type`} className={labelClass}>Type</label>
          <select
            id={`${ids}-type`}
            value={filters.type ?? ''}
            onChange={(e) => changeFilters({ type: (e.target.value || undefined) as InvoiceType | undefined })}
            className={inputClass}
          >
            <option value="">All types</option>
            <option value="PURCHASE">Purchase</option>
            <option value="SALE">Sale</option>
          </select>
        </div>
        <div className="w-44 space-y-1.5">
          <label htmlFor={`${ids}-status`} className={labelClass}>Status</label>
          <select
            id={`${ids}-status`}
            value={filters.status ?? ''}
            onChange={(e) => changeFilters({ status: (e.target.value || undefined) as InvoiceStatus | undefined })}
            className={inputClass}
          >
            <option value="">All statuses</option>
            <option value="NOT_SENT">Not sent</option>
            <option value="SENT">Sent</option>
            <option value="POSTED">Posted</option>
          </select>
        </div>
      </section>

      {loadError && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          {loadError}
        </p>
      )}

      <section aria-label="Invoice list" className={`${cardClass} overflow-hidden`} aria-busy={loading}>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {filters.type || filters.status
              ? 'No invoices match these filters.'
              : 'No invoices yet. Create one from Purchases or Sales.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Number</th>
                  <th scope="col" className="px-5 py-3">Type</th>
                  <th scope="col" className="px-5 py-3">Party</th>
                  <th scope="col" className="px-5 py-3">Date</th>
                  <th scope="col" className="px-5 py-3 text-right">Total</th>
                  <th scope="col" className="px-5 py-3">Status</th>
                  <th scope="col" className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    data-changed={changedIds.has(row.id) || undefined}
                    className={`transition-colors duration-700 ${changedIds.has(row.id) ? 'bg-amber-100' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-900">{row.invoiceNumber}</td>
                    <td className="px-5 py-3"><TypeBadge type={row.type} /></td>
                    <td className="px-5 py-3 text-slate-900">{row.counterpartyName}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-600">{row.date}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                      {row.currency} {row.total}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <a
                        href={api.invoicePdfUrl(row.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View PDF for ${row.invoiceNumber}`}
                        className="font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        View PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void load(filters, 'append', nextCursor)}
            disabled={loading}
            className={secondaryButtonClass}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </main>
  );
}
