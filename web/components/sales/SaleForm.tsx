'use client';

import type { FormEvent } from 'react';
import { InvoiceCreatedNotice } from '@/components/invoicing/InvoiceCreatedNotice';
import { PartyAndDateFields } from '@/components/invoicing/PartyAndDateFields';
import { SubmitError } from '@/components/invoicing/SubmitError';
import { TotalsPreview } from '@/components/invoicing/TotalsPreview';
import { useInvoiceForm } from '@/hooks/useInvoiceForm';
import { useLineItems } from '@/hooks/useLineItems';
import { api, ApiError } from '@/lib/api';
import { INVOICE_MAX_LINES, MOVEMENT_MAX_QUANTITY } from '@/lib/constants';
import { previewLineTotal, previewTotals } from '@/lib/money';
import type { InvoicingSettings, Product } from '@/lib/types';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';

interface SaleLineDraft {
  productId: string;
  quantity: string;
}

const emptyLine = (): SaleLineDraft => ({ productId: '', quantity: '' });

interface SaleFormProps {
  /** Live: available stock updates via SSE while the form is open. */
  products: Product[];
  settings: InvoicingSettings;
}

/**
 * Sell stock to a customer: one SALE invoice, stock OUT per line, priced from
 * the catalogue. Warns early when a line exceeds stock, but the server's 409
 * (all-or-nothing) is what counts, and it names every short product.
 */
export function SaleForm({ products, settings }: SaleFormProps) {
  const form = useInvoiceForm(settings);
  const { lines, add, remove, update, reset, canAdd } = useLineItems(emptyLine, INVOICE_MAX_LINES);

  const productOf = (id: string) => products.find((p) => p.id === id);
  const previewLines = lines.map((line) => ({
    quantity: Number(line.quantity),
    unitPrice: productOf(line.productId)?.price ?? '',
  }));
  const chosenElsewhere = (key: number) =>
    new Set(lines.filter((line) => line.key !== key).map((line) => line.productId));
  const shortIds = new Set(
    form.error instanceof ApiError
      ? (form.error.details.shortages ?? []).map((shortage) => shortage.productId)
      : [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void form.submit(
      ({ partyName, date }) =>
        api.createSale({
          customerName: partyName,
          date,
          // No price: sales are priced by the server from the catalogue.
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: Number(line.quantity),
          })),
        }),
      reset,
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-5 p-5`} aria-label="Sell stock">
      <fieldset disabled={form.submitting} className="space-y-5">
        <PartyAndDateFields
          partyLabel="Customer"
          partyName={form.partyName}
          onPartyNameChange={form.setPartyName}
          date={form.date}
          onDateChange={form.setDate}
          maxDate={settings.today}
        />

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="pb-2 pr-3">Product</th>
                <th scope="col" className="w-28 pb-2 pr-3">Qty</th>
                <th scope="col" className="w-32 pb-2 pr-3 text-right">Unit price</th>
                <th scope="col" className="w-32 pb-2 pr-3 text-right">Line total</th>
                <th scope="col" className="w-10 pb-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const n = index + 1;
                const product = productOf(line.productId);
                const taken = chosenElsewhere(line.key);
                const requested = Number(line.quantity);
                const exceedsStock = product !== undefined && requested > product.quantity;
                const short = shortIds.has(line.productId);
                return (
                  <tr key={line.key} className="align-top" data-short={short || undefined}>
                    <td className="py-1.5 pr-3">
                      <select
                        aria-label={`Product for line ${n}`}
                        required
                        value={line.productId}
                        onChange={(e) => update(line.key, { productId: e.target.value })}
                        className={`${inputClass} ${short ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                      >
                        <option value="">Select a product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} disabled={taken.has(p.id)}>
                            {p.name} ({p.sku}) · {p.quantity} in stock · {settings.currency} {p.price}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        aria-label={`Quantity for line ${n}`}
                        type="number"
                        inputMode="numeric"
                        required
                        min={1}
                        max={MOVEMENT_MAX_QUANTITY}
                        step={1}
                        value={line.quantity}
                        onChange={(e) => update(line.key, { quantity: e.target.value })}
                        className={`${inputClass} ${exceedsStock || short ? 'border-amber-400' : ''}`}
                      />
                      {exceedsStock && (
                        <p role="status" className="mt-1 text-xs font-medium text-amber-700">
                          Only {product.quantity} in stock
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 pr-3 text-right tabular-nums text-slate-700">
                      {product?.price ?? '—'}
                    </td>
                    <td className="py-3.5 pr-3 text-right tabular-nums text-slate-700">
                      {previewLineTotal(previewLines[index]) ?? '—'}
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        aria-label={`Remove line ${n}`}
                        onClick={() => remove(line.key)}
                        disabled={lines.length === 1}
                        className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <button type="button" onClick={add} disabled={!canAdd} className={secondaryButtonClass}>
            + Add line
          </button>
          <TotalsPreview totals={previewTotals(previewLines, settings.taxRate)} settings={settings} />
        </div>

        <div className="flex justify-end">
          <button type="submit" className={primaryButtonClass}>
            {form.submitting ? 'Creating invoice…' : 'Create sales invoice'}
          </button>
        </div>
      </fieldset>

      {form.error !== null && <SubmitError error={form.error} products={products} />}
      {form.created && <InvoiceCreatedNotice invoice={form.created} />}
    </form>
  );
}
