import { ApiProperty } from '@nestjs/swagger';
import { LOW_STOCK_MAX_ITEMS } from '../../common/constants';
import { ProductResponse } from './product.response';

export type CacheStatus = 'HIT' | 'MISS';

export class LowStockResponse {
  @ApiProperty({
    type: 'integer',
    example: 10,
    description: 'Threshold applied (quantity < threshold).',
  })
  threshold: number;

  /** Most urgent first (lowest quantity), capped at LOW_STOCK_MAX_ITEMS. */
  @ApiProperty({
    type: [ProductResponse],
    maxItems: LOW_STOCK_MAX_ITEMS,
    description: 'Lowest quantity first.',
  })
  items: ProductResponse[];
}

/** Internal service result; cacheStatus is surfaced as the X-Cache header, not in the body. */
export interface LowStockResult extends LowStockResponse {
  cacheStatus: CacheStatus;
}
