import { connection } from 'next/server';
import { InventoryDashboard } from '@/components/InventoryDashboard';
import { fetchInventorySnapshot } from '@/lib/snapshot';

export default async function HomePage() {
  // Live data: render on every request. Without this, Next.js would run the
  // fetch once at build time and serve a frozen page (and fail the build if
  // the API is not running).
  await connection();

  // Fetched on the server so the first paint already has data; the client
  // then keeps it live over SSE.
  const snapshot = await fetchInventorySnapshot();
  return <InventoryDashboard initialSnapshot={snapshot} />;
}
