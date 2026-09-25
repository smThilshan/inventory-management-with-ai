import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { STOCK_QUANTITY_MAX } from '../../common/constants';

export class LowStockQueryDto {
  /** Products with quantity strictly below this are "low". Defaults to LOW_STOCK_THRESHOLD. */
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: STOCK_QUANTITY_MAX,
    example: 10,
    description:
      'Products with quantity strictly below this are low. Defaults to the server-configured LOW_STOCK_THRESHOLD.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STOCK_QUANTITY_MAX)
  threshold?: number;
}
