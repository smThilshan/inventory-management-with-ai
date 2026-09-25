import { ProductResponse } from './product.response';

export type CacheStatus = 'HIT' | 'MISS';

export interface LowStockResponse {
  threshold: number;
  /** Most urgent first (lowest quantity), capped at LOW_STOCK_MAX_ITEMS. */
  items: ProductResponse[];
}

export interface LowStockResult extends LowStockResponse {
  cacheStatus: CacheStatus;
}
