import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { STOCK_QUANTITY_MAX } from '../../common/constants';

export class LowStockQueryDto {
  /** Products with quantity strictly below this are "low". Defaults to LOW_STOCK_THRESHOLD. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STOCK_QUANTITY_MAX)
  threshold?: number;
}
