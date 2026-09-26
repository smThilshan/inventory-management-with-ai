'use client';

import { useState } from 'react';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { PageHeader } from '@/components/PageHeader';
import { useStockStream } from '@/hooks/useStockStream';
import { api } from '@/lib/api';
import { PRODUCTS_PAGE_SIZE } from '@/lib/constants';
import type { InvoicingSettings, Product } from '@/lib/types';
import { SaleForm } from './SaleForm';

interface SalesViewProps {
  initialProducts: Product[];
  settings: InvoicingSettings;
}

/** Keeps the available stock shown in the sale form live while it is open. */
export function SalesView({ initialProducts, settings }: SalesViewProps) {
  const [products, setProducts] = useState(initialProducts);

  const status = useStockStream({
    onProductCreated: (product) =>
      setProducts((current) =>
        current.some((p) => p.id === product.id) ? current : [...current, product],
      ),
    onUpdate: ({ productId, quantity }) =>
      setProducts((current) =>
        current.map((p) => (p.id === productId ? { ...p, quantity } : p)),
      ),
    // Events are missed while disconnected: reload the list on every (re)open.
    onOpen: () => {
      api
        .listProducts(PRODUCTS_PAGE_SIZE)
        .then((page) => setProducts(page.items))
        .catch(() => {
          // Keep the current list; live updates continue and the next reconnect retries.
        });
    },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Sell stock"
        description="Creates a SALE invoice priced from the catalogue. All lines succeed, or nothing is saved."
        aside={<ConnectionStatus status={status} />}
      />
      <SaleForm products={products} settings={settings} />
    </main>
  );
}
