import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CACHE_STATUS_HEADER } from '../common/constants';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination-query.dto';
import { Paginated } from '../common/pagination/paginated';
import { CreateProductDto } from './dto/create-product.dto';
import { LowStockQueryDto } from './dto/low-stock-query.dto';
import { LowStockResponse } from './dto/low-stock.response';
import { ProductResponse, toProductResponse } from './dto/product.response';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(@Body() dto: CreateProductDto): Promise<ProductResponse> {
    return toProductResponse(await this.productsService.create(dto));
  }

  @Get()
  async findPage(
    @Query() query: CursorPaginationQueryDto,
  ): Promise<Paginated<ProductResponse>> {
    const page = await this.productsService.findPage(query);
    return { ...page, items: page.items.map(toProductResponse) };
  }

  @Get('low-stock')
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
