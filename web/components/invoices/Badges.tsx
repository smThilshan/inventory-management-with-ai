import type { InvoiceStatus, InvoiceType } from '@/lib/types';

const pill = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

const TYPE: Record<InvoiceType, { label: string; className: string }> = {
  PURCHASE: { label: 'Purchase', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  SALE: { label: 'Sale', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

const STATUS: Record<InvoiceStatus, { label: string; className: string }> = {
  NOT_SENT: { label: 'Not sent', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  SENT: { label: 'Sent', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  POSTED: { label: 'Posted', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

export const TypeBadge = ({ type }: { type: InvoiceType }) => (
  <span className={`${pill} ${TYPE[type].className}`}>{TYPE[type].label}</span>
);

export const StatusBadge = ({ status }: { status: InvoiceStatus }) => (
  <span className={`${pill} ${STATUS[status].className}`}>{STATUS[status].label}</span>
);
