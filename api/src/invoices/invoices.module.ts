import { Module } from '@nestjs/common';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { InvoiceIssuerService } from './invoice-issuer.service';
import { InvoiceNumberService } from './invoice-number.service';
import { InvoiceSettings } from './invoice-settings';
import { InvoicesController } from './invoices.controller';
import { InvoicingSettingsController } from './invoicing-settings.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './pdf/invoice-pdf.service';

@Module({
  imports: [StockMovementsModule],
  controllers: [InvoicesController, InvoicingSettingsController],
  providers: [
    InvoiceNumberService,
    InvoiceSettings,
    InvoiceIssuerService,
    InvoicesService,
    InvoicePdfService,
  ],
  // Purchases and sales are thin front doors onto the same issuer.
  exports: [InvoiceIssuerService, InvoiceNumberService, InvoiceSettings],
})
export class InvoicesModule {}
