import { Module } from '@nestjs/common';
import { ProductMovementsController } from './product-movements.controller';
import { StockLedgerService } from './stock-ledger.service';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';

@Module({
  controllers: [StockMovementsController, ProductMovementsController],
  providers: [StockMovementsService, StockLedgerService],
  // Purchases and sales apply their stock changes through the same ledger.
  exports: [StockLedgerService],
})
export class StockMovementsModule {}
