import type { Metadata } from 'next';
import { connection } from 'next/server';
import { InvoicesView } from '@/components/invoices/InvoicesView';
import { api } from '@/lib/api';
import { INVOICES_PAGE_SIZE } from '@/lib/constants';

export const metadata: Metadata = { title: 'Invoices' };

export default async function InvoicesPage() {
  await connection(); // live data: render per request, never at build time
  const initialPage = await api.listInvoices({ limit: INVOICES_PAGE_SIZE });

  return <InvoicesView initialPage={initialPage} />;
}
