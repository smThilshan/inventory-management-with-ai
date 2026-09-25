import type { StreamStatus } from '@/hooks/useStockStream';

const APPEARANCE: Record<StreamStatus, { label: string; dot: string; badge: string }> = {
  connecting: {
    label: 'Connecting',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
  live: {
    label: 'Live',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-amber-500 animate-pulse',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
};

export function ConnectionStatus({ status }: { status: StreamStatus }) {
  const { label, dot, badge } = APPEARANCE[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${badge}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
