import { formatPercent, isZeroRate, type TotalsPreview as Totals } from '@/lib/money';
import type { InvoicingSettings } from '@/lib/types';

interface TotalsPreviewProps {
  totals: Totals | null;
  settings: InvoicingSettings;
}

/** Display only: the server recalculates every amount and is authoritative. */
export function TotalsPreview({ totals, settings }: TotalsPreviewProps) {
  const amount = (value: string | undefined) =>
    value === undefined ? '—' : `${settings.currency} ${value}`;

  return (
    <section aria-label="Totals preview" className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
      <div className="flex justify-between text-slate-600">
        <span>Subtotal</span>
        <span className="tabular-nums" data-testid="preview-subtotal">
          {amount(totals?.subtotal)}
        </span>
      </div>
      {/* Mirrors the PDF: no misleading "Tax (0%)" row while tax is disabled. */}
      {!isZeroRate(settings.taxRate) && (
        <div className="flex justify-between text-slate-600">
          <span>Tax ({formatPercent(settings.taxRate)}%)</span>
          <span className="tabular-nums">{amount(totals?.tax)}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums" data-testid="preview-total">
          {amount(totals?.total)}
        </span>
      </div>
      <p className="pt-1 text-xs text-slate-400">Preview; final amounts are calculated by the server.</p>
    </section>
  );
}
