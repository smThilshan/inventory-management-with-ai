'use client';

import type { FormEvent } from 'react';
import { InvoiceCreatedNotice } from '@/components/invoicing/InvoiceCreatedNotice';
import { PartyAndDateFields } from '@/components/invoicing/PartyAndDateFields';
import { SubmitError } from '@/components/invoicing/SubmitError';
import { TotalsPreview } from '@/components/invoicing/TotalsPreview';
import { useInvoiceForm } from '@/hooks/useInvoiceForm';
import { useLineItems } from '@/hooks/useLineItems';
import { api } from '@/lib/api';
import { INVOICE_MAX_LINES, MOVEMENT_MAX_QUANTITY } from '@/lib/constants';
import { previewLineTotal, previewTotals } from '@/lib/money';
import type { InvoicingSettings, Product } from '@/lib/types';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';

interface PurchaseLineDraft {
  productId: string;
  quantity: string;
  unitCost: string;
}

const emptyLine = (): PurchaseLineDraft => ({ productId: '', quantity: '', unitCost: '' });

interface PurchaseFormProps {
  products: Product[];
  settings: InvoicingSettings;
}

/** Receive stock from a supplier: one PURCHASE invoice, stock IN per line. */
export function PurchaseForm({ products, settings }: PurchaseFormProps) {
  const form = useInvoiceForm(settings);
  const { lines, add, remove, update, reset, canAdd } = useLineItems(emptyLine, INVOICE_MAX_LINES);

  const previewLines = lines.map((line) => ({
    quantity: Number(line.quantity),
    unitPrice: line.unitCost,
  }));
  const chosenElsewhere = (key: number) =>
    new Set(lines.filter((line) => line.key !== key).map((line) => line.productId));

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void form.submit(
      ({ partyName, date }) =>
        api.createPurchase({
          supplierName: partyName,
          date,
          lines: lines.map((line) => ({
            productId: line.productId,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
          })),
        }),
      reset,
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} space-y-5 p-5`} aria-label="Receive stock">
      <fieldset disabled={form.submitting} className="space-y-5">
        <PartyAndDateFields
          partyLabel="Supplier"
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
                <th scope="col" className="w-36 pb-2 pr-3">Unit cost ({settings.currency})</th>
                <th scope="col" className="w-32 pb-2 pr-3 text-right">Line total</th>
                <th scope="col" className="w-10 pb-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const n = index + 1;
                const taken = chosenElsewhere(line.key);
                return (
                  <tr key={line.key} className="align-top">
                    <td className="py-1.5 pr-3">
                      <select
                        aria-label={`Product for line ${n}`}
                        required
                        value={line.productId}
                        onChange={(e) => update(line.key, { productId: e.target.value })}
                        className={inputClass}
                      >
                        <option value="">Select a product…</option>
                        {products.map((p) => (
                          // A product can appear on one line only (the API rejects duplicates).
                          <option key={p.id} value={p.id} disabled={taken.has(p.id)}>
                            {p.name} ({p.sku})
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
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        aria-label={`Unit cost for line ${n}`}
                        type="number"
                        inputMode="decimal"
                        required
                        min={0.01}
                        step={0.01}
                        value={line.unitCost}
                        onChange={(e) => update(line.key, { unitCost: e.target.value })}
                        className={inputClass}
                      />
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
            {form.submitting ? 'Creating invoice…' : 'Create purchase invoice'}
          </button>
        </div>
      </fieldset>

      {form.error !== null && <SubmitError error={form.error} products={products} />}
      {form.created && <InvoiceCreatedNotice invoice={form.created} />}
    </form>
  );
}
