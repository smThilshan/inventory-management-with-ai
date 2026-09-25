import type { LowStockList, Product, StockUpdatedEvent } from './types';

export type LowStockItem = Pick<Product, 'id' | 'sku' | 'name' | 'quantity'>;

export interface InventoryState {
  products: Product[];
  lowStock: LowStockItem[];
  threshold: number;
  /** More products exist beyond the loaded page. */
  hasMoreProducts: boolean;
}

export interface InventorySnapshot {
  products: Product[];
  lowStock: LowStockList;
  hasMoreProducts: boolean;
}

export type InventoryAction =
  | { type: 'stockUpdated'; event: StockUpdatedEvent }
  /** A fresh snapshot, plus events that arrived while it was being fetched. */
  | { type: 'resynced'; snapshot: InventorySnapshot; replay: StockUpdatedEvent[] };

/** Same rule as the API: strictly below the threshold. */
export const isLowStock = (quantity: number, threshold: number): boolean =>
  quantity < threshold;

/** Same order as the API: most urgent (lowest quantity) first. */
const byUrgency = (a: LowStockItem, b: LowStockItem): number =>
  a.quantity - b.quantity || a.id.localeCompare(b.id);

const toLowStockItem = ({ id, sku, name, quantity }: Product): LowStockItem => ({
  id,
  sku,
  name,
  quantity,
});

export function createInventory({
  products,
  lowStock,
  hasMoreProducts,
}: InventorySnapshot): InventoryState {
  return {
    products,
    lowStock: lowStock.items.map(toLowStockItem),
    threshold: lowStock.threshold,
    hasMoreProducts,
  };
}

// Events carry the absolute quantity (not a delta), so applying one is
// idempotent and replaying an already-applied event is harmless.
function applyStockUpdate(
  state: InventoryState,
  { productId, sku, quantity, movement }: StockUpdatedEvent,
): InventoryState {
  const products = state.products.map((product) =>
    product.id === productId
      ? { ...product, quantity, updatedAt: movement.createdAt }
      : product,
  );

  // The product may be outside the loaded table page; fall back to the SKU as its label.
  const name =
    products.find((p) => p.id === productId)?.name ??
    state.lowStock.find((p) => p.id === productId)?.name ??
    sku;
  const others = state.lowStock.filter((item) => item.id !== productId);
  const lowStock = isLowStock(quantity, state.threshold)
    ? [...others, { id: productId, sku, name, quantity }].sort(byUrgency)
    : others;

  return { ...state, products, lowStock };
}

export function inventoryReducer(
  state: InventoryState,
  action: InventoryAction,
): InventoryState {
  switch (action.type) {
    case 'stockUpdated':
      return applyStockUpdate(state, action.event);
    case 'resynced':
      return action.replay.reduce(
        applyStockUpdate,
        createInventory(action.snapshot),
      );
  }
}
