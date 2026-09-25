import { Body, Controller, Post } from '@nestjs/common';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import {
  StockMovementResultResponse,
  toStockMovementResultResponse,
} from './dto/stock-movement.response';
import { StockMovementsService } from './stock-movements.service';

@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  async create(
    @Body() dto: CreateStockMovementDto,
  ): Promise<StockMovementResultResponse> {
    return toStockMovementResultResponse(
      await this.stockMovementsService.record(dto),
    );
  }
}
