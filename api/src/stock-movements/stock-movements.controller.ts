import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { API_TAGS } from '../swagger.setup';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import {
  StockMovementResultResponse,
  toStockMovementResultResponse,
} from './dto/stock-movement.response';
import { StockMovementsService } from './stock-movements.service';

@ApiTags(API_TAGS.stockMovements)
@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  @ApiOperation({
    operationId: 'createStockMovement',
    summary: 'Record an IN or OUT stock movement',
    description:
      'Atomic: the quantity update and the ledger entry commit together. Concurrent OUTs can ' +
      'never oversell (conditional UPDATE). On success a `stock.updated` event is pushed to ' +
      'GET /events/stock after commit.',
  })
  @ApiCreatedResponse({ type: StockMovementResultResponse })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid body or unknown fields')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Product not found')
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'Insufficient stock (OUT), or stock quantity limit exceeded (IN)',
  )
  async create(
    @Body() dto: CreateStockMovementDto,
  ): Promise<StockMovementResultResponse> {
    return toStockMovementResultResponse(
      await this.stockMovementsService.record(dto),
    );
  }
}
