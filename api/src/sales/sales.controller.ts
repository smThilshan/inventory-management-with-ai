import { Body, Controller, HttpStatus, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import {
  InvoiceResponse,
  toInvoiceResponse,
} from '../invoices/dto/invoice.response';
import { ProductsNotFoundResponse } from '../invoices/dto/products-not-found.response';
import { StockShortageResponse } from '../invoices/dto/stock-shortage.response';
import { API_TAGS } from '../swagger.setup';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@ApiTags(API_TAGS.invoicing)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @ApiOperation({
    operationId: 'createSale',
    summary: 'Sell stock to a customer (creates a SALE invoice)',
    description:
      "One transaction: a SALE invoice priced from each product's current price " +
      '(snapshotted on the line), and a stock OUT movement per line. All or nothing: ' +
      'if any line lacks stock, nothing is saved and the 409 lists every short SKU. ' +
      'After commit, `stock.updated` per product and `invoice.created` are published.',
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
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'One or more lines lack stock (all listed); nothing was saved',
    type: StockShortageResponse,
  })
  async create(@Body() dto: CreateSaleDto): Promise<InvoiceResponse> {
    return toInvoiceResponse(await this.salesService.create(dto));
  }
}
