import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LOW_STOCK_MAX_ITEMS,
  OPENING_STOCK_NOTE,
  PRICE_DECIMAL_PLACES,
} from '../common/constants';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination-query.dto';
import { Paginated, toPage } from '../common/pagination/paginated';
import { EnvironmentVariables } from '../config/env.validation';
import { MovementType, Product } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { LowStockResult } from './dto/low-stock.response';
import { toProductResponse } from './dto/product.response';
import { PRODUCT_CREATED_EVENT } from './events/product-created.event';
import { LowStockCache } from './low-stock.cache';

@Injectable()
export class ProductsService {
  private readonly defaultLowStockThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lowStockCache: LowStockCache,
    private readonly events: EventEmitter2,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.defaultLowStockThreshold = config.get('LOW_STOCK_THRESHOLD', {
      infer: true,
    });
  }

  /**
   * SKU uniqueness is enforced by the DB index (P2002 → 409 in the global filter),
   * which is race-free unlike a "find, then insert" check.
   */
  async create(dto: CreateProductDto): Promise<Product> {
    const { quantity = 0, price, ...fields } = dto;

    const product = await this.prisma.product.create({
      data: {
        ...fields,
        quantity,
        // Validated to <= 2 dp, so toFixed yields the exact decimal string.
        price: price.toFixed(PRICE_DECIMAL_PLACES),
        // Nested write: product and its opening ledger entry commit atomically.
        movements:
          quantity > 0
            ? {
                create: {
                  type: MovementType.IN,
                  quantity,
                  note: OPENING_STOCK_NOTE,
                },
              }
            : undefined,
      },
    });

    // Awaited so the caller's next low-stock read already includes the new product.
    await this.lowStockCache.invalidateAll();
    // After commit: lets every open window (dashboard, sale form) show it live.
    await this.events.emitAsync(
      PRODUCT_CREATED_EVENT,
      toProductResponse(product),
    );
    return product;
  }

  /**
   * Keyset pagination on the UUIDv7 primary key (time-ordered = creation order).
   * `WHERE id > cursor` uses the PK index, stays O(limit) at any depth, and
   * never skips or duplicates rows when products are inserted between pages.
   */
  async findPage({
    limit,
    cursor,
  }: CursorPaginationQueryDto): Promise<Paginated<Product>> {
    const rows = await this.prisma.product.findMany({
      where: cursor ? { id: { gt: cursor } } : undefined,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    return toPage(rows, limit);
  }

  /**
   * Cache-aside: serve from Redis when possible, otherwise query Postgres
   * (served by the quantity index) and populate the cache for the next caller.
   * The serialized response is cached, so a HIT skips the DB and mapping entirely.
   */
  async findLowStock(
    threshold: number = this.defaultLowStockThreshold,
  ): Promise<LowStockResult> {
    const cached = await this.lowStockCache.get(threshold);
    if (cached) {
      return { threshold, items: cached, cacheStatus: 'HIT' };
    }

    const rows = await this.prisma.product.findMany({
      where: { quantity: { lt: threshold } },
      orderBy: [{ quantity: 'asc' }, { id: 'asc' }],
      take: LOW_STOCK_MAX_ITEMS,
    });
    const items = rows.map(toProductResponse);

    await this.lowStockCache.set(threshold, items);
    return { threshold, items, cacheStatus: 'MISS' };
  }
}
