import { api } from '@/lib/api';
import type { Invoice } from '@/lib/types';

export function InvoiceCreatedNotice({ invoice }: { invoice: Invoice }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200"
    >
      <p>
        Invoice <span className="font-semibold">{invoice.invoiceNumber}</span> created
        {' · '}Total {invoice.currency} {invoice.total}
      </p>
      <a
        href={api.invoicePdfUrl(invoice.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
      >
        View PDF
      </a>
    </div>
  );
}
