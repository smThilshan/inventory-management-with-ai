import { ApiProperty } from '@nestjs/swagger';
import { ErrorResponse } from '../../common/swagger/error.response';

export class StockShortageItem {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'MN-4K-027' })
  sku: string;

  @ApiProperty({ type: 'integer', example: 5 })
  requested: number;

  @ApiProperty({
    type: 'integer',
    example: 2,
    description: 'Stock available when the sale was attempted.',
  })
  available: number;
}

export class StockShortageResponse extends ErrorResponse {
  @ApiProperty({
    type: [StockShortageItem],
    description: 'Every line that lacks stock, in the order submitted.',
  })
  shortages: StockShortageItem[];
}
