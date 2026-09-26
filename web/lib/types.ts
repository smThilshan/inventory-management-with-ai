// Mirrors the API contract (see http://localhost:3001/docs).

export type MovementType = 'IN' | 'OUT';
export type MovementReason = 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
export type InvoiceType = 'PURCHASE' | 'SALE';
export type InvoiceStatus = 'NOT_SENT' | 'SENT' | 'POSTED';

export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  /** Decimal string with 2 places, e.g. "89.99". Never parsed into a float. */
  price: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPage {
  items: Product[];
  nextCursor: string | null;
}

export interface LowStockList {
  /** Products with quantity strictly below this are low. */
  threshold: number;
  items: Product[];
}

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  /** PURCHASE/SALE link to an invoice; ADJUSTMENT never does. */
  reason: MovementReason;
  invoiceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface StockMovementResult {
  product: Product;
  movement: StockMovement;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  /** Opening stock (stock take); recorded as an ADJUSTMENT movement. Defaults to 0. */
  quantity?: number;
  price: number;
}

export interface CreateStockMovementInput {
  productId: string;
  type: MovementType;
  quantity: number;
  note?: string;
}

/** Payload of the `stock.updated` SSE event, sent after the change commits. */
export interface StockUpdatedEvent {
  productId: string;
  sku: string;
  /** Product quantity after the movement. */
  quantity: number;
  movement: StockMovement;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---- Invoicing ----

export interface InvoicingSettings {
  /** Decimal string, e.g. "0" or "0.05". */
  taxRate: string;
  currency: string;
  dueDays: number;
  /** Today in the business time zone: default and latest invoice date. */
  today: string;
}

export interface InvoiceLine {
  id: string;
  lineNumber: number;
  productId: string;
  /** Product name when invoiced (snapshot). */
  description: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  /** Supplier for a PURCHASE, customer for a SALE. */
  counterpartyName: string;
  companyName: string;
  companyAddress: string;
  /** YYYY-MM-DD */
  date: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice extends InvoiceSummary {
  lines: InvoiceLine[];
}

export interface InvoicePage {
  items: InvoiceSummary[];
  nextCursor: string | null;
}

export interface InvoiceFilters {
  type?: InvoiceType;
  status?: InvoiceStatus;
}

/** Payload of the `invoice.created` SSE event, sent after the invoice commits. */
export interface InvoiceCreatedEvent {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  counterpartyName: string;
  date: string;
  currency: string;
  total: string;
  status: InvoiceStatus;
}

export interface CreatePurchaseInput {
  supplierName: string;
  date?: string;
  lines: { productId: string; quantity: number; unitCost: number }[];
}

export interface CreateSaleInput {
  customerName: string;
  date?: string;
  lines: { productId: string; quantity: number }[];
}

/** One short line in a rejected sale (409). */
export interface StockShortage {
  productId: string;
  sku: string;
  requested: number;
  available: number;
}
