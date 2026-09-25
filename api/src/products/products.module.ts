import { Module } from '@nestjs/common';
import { LowStockCache } from './low-stock.cache';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, LowStockCache],
})
export class ProductsModule {}
