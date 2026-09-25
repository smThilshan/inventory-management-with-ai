import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  StockMovementResponse,
  toStockMovementResponse,
} from './dto/stock-movement.response';
import { StockMovementsService } from './stock-movements.service';

/** Movement history, exposed as a sub-resource of the product it belongs to. */
@Controller('products/:productId/movements')
export class ProductMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  // Wrapped in { items } so pagination metadata can be added later without a breaking change.
  @Get()
  async findRecent(
    @Param('productId', new ParseUUIDPipe({ version: '7' })) productId: string,
  ): Promise<{ items: StockMovementResponse[] }> {
    const movements =
      await this.stockMovementsService.findRecentForProduct(productId);
    return { items: movements.map(toStockMovementResponse) };
  }
}
