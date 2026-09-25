// Mirrors the API contract (see http://localhost:3001/docs).

export type MovementType = 'IN' | 'OUT';

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
  note: string | null;
  createdAt: string;
}

export interface StockMovementResult {
  product: Product;
  movement: StockMovement;
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
