import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CACHE_STATUS_HEADER } from '../common/constants';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination-query.dto';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { API_TAGS } from '../swagger.setup';
import { CreateProductDto } from './dto/create-product.dto';
import { LowStockQueryDto } from './dto/low-stock-query.dto';
import { LowStockResponse } from './dto/low-stock.response';
import {
  ProductPageResponse,
  ProductResponse,
  toProductResponse,
} from './dto/product.response';
import { ProductsService } from './products.service';

@ApiTags(API_TAGS.products)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({
    operationId: 'createProduct',
    summary: 'Create a product',
    description:
      'A positive opening quantity is recorded as an IN movement in the same transaction.',
  })
  @ApiCreatedResponse({ type: ProductResponse })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid body or unknown fields')
  @ApiErrorResponse(HttpStatus.CONFLICT, 'SKU already exists')
  async create(@Body() dto: CreateProductDto): Promise<ProductResponse> {
    return toProductResponse(await this.productsService.create(dto));
  }

  @Get()
  @ApiOperation({
    operationId: 'listProducts',
    summary: 'List products (cursor pagination)',
    description:
      'Ordered by creation. Follow `nextCursor` until it is null; stable while products are added.',
  })
  @ApiOkResponse({ type: ProductPageResponse })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid limit or cursor')
  async findPage(
    @Query() query: CursorPaginationQueryDto,
  ): Promise<ProductPageResponse> {
    const page = await this.productsService.findPage(query);
    return { ...page, items: page.items.map(toProductResponse) };
  }

  @Get('low-stock')
  @ApiOperation({
    operationId: 'listLowStockProducts',
    summary: 'Products below a stock threshold (Redis cached)',
    description:
      'Cache-aside with a short TTL, invalidated on every stock change and product creation. ' +
      'Falls back to the database if Redis is unavailable.',
  })
  @ApiOkResponse({
    type: LowStockResponse,
    headers: {
      [CACHE_STATUS_HEADER]: {
        description: 'Whether the response was served from the cache',
        schema: { type: 'string', enum: ['HIT', 'MISS'] },
      },
    },
  })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid threshold')
  async findLowStock(
    @Query() { threshold }: LowStockQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LowStockResponse> {
    const { cacheStatus, ...body } =
      await this.productsService.findLowStock(threshold);
    res.setHeader(CACHE_STATUS_HEADER, cacheStatus);
    return body;
  }
}
