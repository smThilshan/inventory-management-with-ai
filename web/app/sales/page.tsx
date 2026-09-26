import type { Metadata } from 'next';
import { connection } from 'next/server';
import { SalesView } from '@/components/sales/SalesView';
import { api } from '@/lib/api';
import { PRODUCTS_PAGE_SIZE } from '@/lib/constants';

export const metadata: Metadata = { title: 'Sell stock' };

export default async function SalesPage() {
  await connection(); // live data: render per request, never at build time
  const [products, settings] = await Promise.all([
    api.listProducts(PRODUCTS_PAGE_SIZE),
    api.getInvoicingSettings(),
  ]);

  return <SalesView initialProducts={products.items} settings={settings} />;
}
