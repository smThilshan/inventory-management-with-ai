import type { LowStockItem } from '@/lib/inventory';

interface LowStockPanelProps {
  items: LowStockItem[];
  threshold: number;
}

export function LowStockPanel({ items, threshold }: LowStockPanelProps) {
  return (
    <section
      aria-labelledby="low-stock-heading"
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-baseline justify-between border-b border-slate-200 px-5 py-4">
        <h2 id="low-stock-heading" className="text-base font-semibold text-slate-900">
          Low stock
        </h2>
        <p className="text-sm text-slate-500">below {threshold}</p>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">All products are above the threshold.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                <p className="font-mono text-xs text-slate-500">{item.sku}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${
                  item.quantity === 0
                    ? 'bg-red-50 text-red-700 ring-red-200'
                    : 'bg-amber-50 text-amber-800 ring-amber-200'
                }`}
              >
                {item.quantity === 0 ? 'Out of stock' : `${item.quantity} left`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
