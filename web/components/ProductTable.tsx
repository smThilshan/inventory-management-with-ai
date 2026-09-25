import { PRODUCTS_PAGE_SIZE } from '@/lib/constants';
import { isLowStock } from '@/lib/inventory';
import type { Product } from '@/lib/types';

interface ProductTableProps {
  products: Product[];
  threshold: number;
  /** Rows to highlight because they just changed live. */
  changedIds: ReadonlySet<string>;
  hasMore: boolean;
}

export function ProductTable({
  products,
  threshold,
  changedIds,
  hasMore,
}: ProductTableProps) {
  return (
    <section
      aria-labelledby="products-heading"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-baseline justify-between border-b border-slate-200 px-5 py-4">
        <h2 id="products-heading" className="text-base font-semibold text-slate-900">
          Products
        </h2>
        <p className="text-sm text-slate-500">{products.length} items</p>
      </header>

      {products.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No products yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3">Name</th>
                <th scope="col" className="px-5 py-3">SKU</th>
                <th scope="col" className="px-5 py-3 text-right">Quantity</th>
                <th scope="col" className="px-5 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => {
                const low = isLowStock(product.quantity, threshold);
                const changed = changedIds.has(product.id);
                return (
                  <tr
                    key={product.id}
                    data-changed={changed || undefined}
                    className={`transition-colors duration-700 ${changed ? 'bg-amber-100' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">{product.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{product.sku}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={low ? 'font-semibold text-red-600' : 'text-slate-900'}>
                        {product.quantity}
                      </span>
                      {low && (
                        <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
                          Low
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">{product.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          Showing the first {PRODUCTS_PAGE_SIZE} products.
        </p>
      )}
    </section>
  );
}
