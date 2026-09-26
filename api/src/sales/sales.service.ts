import { Injectable } from '@nestjs/common';
import { InvoiceType } from '../generated/prisma/client';
import { InvoiceWithLines } from '../invoices/dto/invoice.response';
import { InvoiceIssuerService } from '../invoices/invoice-issuer.service';
import { CreateSaleDto } from './dto/create-sale.dto';

/**
 * Selling to a customer: stock OUT per line + one SALE invoice, priced from the
 * catalogue at the time of sale. All or nothing: if any line lacks stock the
 * whole sale is rejected (409 listing every short SKU) and nothing is saved.
 */
@Injectable()
export class SalesService {
  constructor(private readonly issuer: InvoiceIssuerService) {}

  create(dto: CreateSaleDto): Promise<InvoiceWithLines> {
    return this.issuer.issue({
      type: InvoiceType.SALE,
      counterpartyName: dto.customerName,
      date: dto.date,
      lines: dto.lines.map(({ productId, quantity }) => ({
        productId,
        quantity,
      })),
    });
  }
}
