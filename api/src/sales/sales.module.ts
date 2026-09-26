import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [InvoicesModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
