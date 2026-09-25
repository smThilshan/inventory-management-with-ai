import { StockMovementResponse } from '../dto/stock-movement.response';

/** Single source of truth for the event name; listeners import it rather than repeating the string. */
export const STOCK_UPDATED_EVENT = 'stock.updated';

/**
 * Emitted only after the DB transaction commits, so listeners never observe a
 * change that could still roll back. JSON-safe: it is streamed to browsers as-is.
 */
export interface StockUpdatedEvent {
  productId: string;
  sku: string;
  /** Product quantity after the movement was applied. */
  quantity: number;
  movement: StockMovementResponse;
}
