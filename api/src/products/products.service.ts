import { Injectable } from '@nestjs/common';
import { OPENING_STOCK_NOTE, PRICE_DECIMAL_PLACES } from '../common/constants';
import { CursorPaginationQueryDto } from '../common/pagination/cursor-pagination-query.dto';
import { Paginated, toPage } from '../common/pagination/paginated';
import { MovementType, Product } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SKU uniqueness is enforced by the DB index (P2002 → 409 in the global filter),
   * which is race-free unlike a "find, then insert" check.
   */
  async create(dto: CreateProductDto): Promise<Product> {
    const { quantity = 0, price, ...fields } = dto;

    return this.prisma.product.create({
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
}
