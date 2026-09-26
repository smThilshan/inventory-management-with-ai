import type { Metadata } from 'next';
import { connection } from 'next/server';
import { PageHeader } from '@/components/PageHeader';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { api } from '@/lib/api';
import { PRODUCTS_PAGE_SIZE } from '@/lib/constants';

export const metadata: Metadata = { title: 'Receive stock' };

export default async function PurchasesPage() {
  await connection(); // live data: render per request, never at build time
  const [products, settings] = await Promise.all([
    api.listProducts(PRODUCTS_PAGE_SIZE),
    api.getInvoicingSettings(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Receive stock"
        description="Creates a PURCHASE invoice from the supplier and adds each line to stock."
      />
      <PurchaseForm products={products.items} settings={settings} />
    </main>
  );
}
