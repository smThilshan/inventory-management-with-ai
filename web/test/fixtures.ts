import type { InventorySnapshot } from '@/lib/inventory';
import type { MovementType, Product, StockUpdatedEvent } from '@/lib/types';

export const THRESHOLD = 10;

export const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-keyboard',
  name: 'Mechanical Keyboard',
  sku: 'KB-MECH-001',
  quantity: 45,
  price: '89.99',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const keyboard = product();
export const monitor = product({ id: 'p-monitor', name: '27" 4K Monitor', sku: 'MN-4K-027', quantity: 8, price: '329.00' });
export const mouse = product({ id: 'p-mouse', name: 'Wireless Mouse', sku: 'MS-WL-002', quantity: 120, price: '24.50' });

export const snapshot = (products: Product[] = [keyboard, monitor, mouse]): InventorySnapshot => ({
  products,
  lowStock: {
    threshold: THRESHOLD,
    items: products.filter((p) => p.quantity < THRESHOLD).sort((a, b) => a.quantity - b.quantity),
  },
  hasMoreProducts: false,
});

export const stockUpdated = (
  target: Product,
  quantity: number,
  type: MovementType = 'OUT',
): StockUpdatedEvent => ({
  productId: target.id,
  sku: target.sku,
  quantity,
  movement: {
    id: `m-${target.id}-${quantity}`,
    productId: target.id,
    type,
    quantity: Math.abs(target.quantity - quantity) || 1,
    note: null,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
});
