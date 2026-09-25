import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MOVEMENT_HISTORY_LIMIT } from '../common/constants';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { API_TAGS } from '../swagger.setup';
import {
  MovementHistoryResponse,
  toStockMovementResponse,
} from './dto/stock-movement.response';
import { StockMovementsService } from './stock-movements.service';

/** Movement history, exposed as a sub-resource of the product it belongs to. */
@ApiTags(API_TAGS.stockMovements)
@Controller('products/:productId/movements')
export class ProductMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  // Wrapped in { items } so pagination metadata can be added later without a breaking change.
  @Get()
  @ApiOperation({
    operationId: 'listProductMovements',
    summary: `Latest ${MOVEMENT_HISTORY_LIMIT} movements of a product`,
    description: 'Newest first.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiOkResponse({ type: MovementHistoryResponse })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Malformed product id')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Product not found')
  async findRecent(
    @Param('productId', new ParseUUIDPipe({ version: '7' })) productId: string,
  ): Promise<MovementHistoryResponse> {
    const movements =
      await this.stockMovementsService.findRecentForProduct(productId);
    return { items: movements.map(toStockMovementResponse) };
  }
}
