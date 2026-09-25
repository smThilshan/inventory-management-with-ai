'use client';

import { useReducer, useRef } from 'react';
import { useRecentlyChanged } from '@/hooks/useRecentlyChanged';
import { useStockStream } from '@/hooks/useStockStream';
import { CHANGE_HIGHLIGHT_MS } from '@/lib/constants';
import {
  createInventory,
  inventoryReducer,
  type InventorySnapshot,
} from '@/lib/inventory';
import { fetchInventorySnapshot } from '@/lib/snapshot';
import type { StockUpdatedEvent } from '@/lib/types';
import { ConnectionStatus } from './ConnectionStatus';
import { LowStockPanel } from './LowStockPanel';
import { MovementForm } from './MovementForm';
import { ProductTable } from './ProductTable';

interface Resync {
  /** Events received while the snapshot request was in flight. */
  buffer: StockUpdatedEvent[];
}

export function InventoryDashboard({ initialSnapshot }: { initialSnapshot: InventorySnapshot }) {
  const [inventory, dispatch] = useReducer(inventoryReducer, initialSnapshot, createInventory);
  const { changedIds, markChanged } = useRecentlyChanged(CHANGE_HIGHLIGHT_MS);
  const activeResync = useRef<Resync | null>(null);

  const status = useStockStream({
    onUpdate: (event) => {
      dispatch({ type: 'stockUpdated', event });
      markChanged(event.productId);
      activeResync.current?.buffer.push(event);
    },

    // Events emitted while we were not connected are lost: before the first
    // open (between server render and hydration) or during a disconnect. So on
    // every open, reload a snapshot and replay whatever arrived meanwhile;
    // otherwise an event newer than the snapshot could be overwritten by it.
    onOpen: () => {
      const resync: Resync = { buffer: [] };
      activeResync.current = resync;
      fetchInventorySnapshot()
        .then((snapshot) => {
          if (activeResync.current !== resync) return; // superseded by a newer open
          dispatch({ type: 'resynced', snapshot, replay: resync.buffer });
        })
        .catch(() => {
          // Keep the current data: the stream is open, so live updates continue
          // and the next reconnect retries the resync.
        })
        .finally(() => {
          if (activeResync.current === resync) activeResync.current = null;
        });
    },
  });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500">Stock levels update live across every open window.</p>
        </div>
        <ConnectionStatus status={status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProductTable
            products={inventory.products}
            threshold={inventory.threshold}
            changedIds={changedIds}
            hasMore={inventory.hasMoreProducts}
          />
        </div>
        <div className="space-y-6">
          <MovementForm products={inventory.products} />
          <LowStockPanel items={inventory.lowStock} threshold={inventory.threshold} />
        </div>
      </div>
    </main>
  );
}
