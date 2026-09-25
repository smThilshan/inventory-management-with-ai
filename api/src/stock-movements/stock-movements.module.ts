import { Module } from '@nestjs/common';
import { ProductMovementsController } from './product-movements.controller';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';

@Module({
  controllers: [StockMovementsController, ProductMovementsController],
  providers: [StockMovementsService],
})
export class StockMovementsModule {}
