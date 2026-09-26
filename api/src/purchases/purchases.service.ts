import { Injectable } from '@nestjs/common';
import { PRICE_DECIMAL_PLACES } from '../common/constants';
import { InvoiceType } from '../generated/prisma/client';
import { InvoiceWithLines } from '../invoices/dto/invoice.response';
import { InvoiceIssuerService } from '../invoices/invoice-issuer.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

/** Receiving stock from a supplier: stock IN per line + one PURCHASE invoice. */
@Injectable()
export class PurchasesService {
  constructor(private readonly issuer: InvoiceIssuerService) {}

  create(dto: CreatePurchaseDto): Promise<InvoiceWithLines> {
    return this.issuer.issue({
      type: InvoiceType.PURCHASE,
      counterpartyName: dto.supplierName,
      date: dto.date,
      lines: dto.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        // Validated to <= 2 dp, so toFixed gives the exact decimal string:
        // the cost enters Decimal math without ever being used as a float.
        unitPrice: line.unitCost.toFixed(PRICE_DECIMAL_PLACES),
      })),
    });
  }
}
