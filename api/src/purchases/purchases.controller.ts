import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { ProductsNotFoundResponse } from '../invoices/dto/products-not-found.response';
import {
  InvoiceResponse,
  toInvoiceResponse,
} from '../invoices/dto/invoice.response';
import { API_TAGS } from '../swagger.setup';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

@ApiTags(API_TAGS.invoicing)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @ApiOperation({
    operationId: 'createPurchase',
    summary: 'Receive stock from a supplier (creates a PURCHASE invoice)',
    description:
      'One transaction: a PURCHASE invoice with one line per product, and a stock IN ' +
      'movement per line linked to the invoice. All or nothing. After commit, a ' +
      '`stock.updated` event per product and an `invoice.created` event are published.',
  })
  @ApiCreatedResponse({ type: InvoiceResponse })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'Invalid body, duplicate productId, future date, or total too large',
  )
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'One or more products do not exist (all listed)',
    type: ProductsNotFoundResponse,
  })
  async create(@Body() dto: CreatePurchaseDto): Promise<InvoiceResponse> {
    return toInvoiceResponse(await this.purchasesService.create(dto));
  }
}
