import type { InventorySnapshot } from '@/lib/inventory';
import type {
  Invoice,
  InvoiceCreatedEvent,
  InvoiceSummary,
  InvoicingSettings,
  MovementType,
  Product,
  StockUpdatedEvent,
} from '@/lib/types';

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
    reason: 'ADJUSTMENT',
    invoiceId: null,
    note: null,
    createdAt: '2026-01-02T00:00:00.000Z',
  },
});

export const settings = (overrides: Partial<InvoicingSettings> = {}): InvoicingSettings => ({
  taxRate: '0',
  currency: 'AED',
  dueDays: 30,
  today: '2026-09-25',
  ...overrides,
});

export const invoiceSummary = (overrides: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  id: '01a0d9f8-0000-7000-8000-000000000001',
  invoiceNumber: 'PUR-2026-0001',
  type: 'PURCHASE',
  status: 'NOT_SENT',
  counterpartyName: 'Gulf Tech Distributors',
  companyName: 'Demo Trading LLC',
  companyAddress: 'Business Bay, Dubai',
  date: '2026-09-25',
  dueDate: '2026-10-25',
  currency: 'AED',
  subtotal: '762.50',
  taxRate: '0',
  taxAmount: '0.00',
  total: '762.50',
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T10:00:00.000Z',
  ...overrides,
});

export const createdInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  ...invoiceSummary(),
  lines: [],
  ...overrides,
});

export const invoiceCreated = (
  overrides: Partial<InvoiceCreatedEvent> = {},
): InvoiceCreatedEvent => ({
  id: '01a0d9f8-0000-7000-8000-000000000099',
  invoiceNumber: 'SAL-2026-0007',
  type: 'SALE',
  counterpartyName: 'Al Noor Trading',
  date: '2026-09-25',
  currency: 'AED',
  total: '187.99',
  status: 'NOT_SENT',
  ...overrides,
});
