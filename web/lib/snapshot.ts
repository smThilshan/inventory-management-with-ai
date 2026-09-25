import { api } from './api';
import { PRODUCTS_PAGE_SIZE } from './constants';
import type { InventorySnapshot } from './inventory';

/** Current products and low-stock list. Used by the server render and by client resyncs. */
export async function fetchInventorySnapshot(): Promise<InventorySnapshot> {
  const [page, lowStock] = await Promise.all([
    api.listProducts(PRODUCTS_PAGE_SIZE),
    api.listLowStock(),
  ]);
  return {
    products: page.items,
    lowStock,
    hasMoreProducts: page.nextCursor !== null,
  };
}
