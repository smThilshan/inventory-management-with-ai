import { ApiProperty } from '@nestjs/swagger';
import { PRICE_DECIMAL_PLACES } from '../../common/constants';
import { Product } from '../../generated/prisma/client';

// Classes (not interfaces) so Swagger can read them at runtime; mappers still
// return plain object literals thanks to structural typing.
export class ProductResponse {
  @ApiProperty({
    format: 'uuid',
    example: '01a0d808-8133-756c-91ec-f48e7e50d3c8',
  })
  id: string;

  @ApiProperty({ example: 'Mechanical Keyboard' })
  name: string;

  @ApiProperty({ example: 'KB-MECH-001' })
  sku: string;

  @ApiProperty({ type: 'integer', minimum: 0, example: 45 })
  quantity: number;

  /** Decimal as a fixed 2-dp string ("19.90") so clients never parse money into a float. */
  @ApiProperty({
    example: '89.99',
    pattern: '^\\d+\\.\\d{2}$',
    description: 'Decimal string with exactly 2 places; never a float.',
  })
  price: string;

  /** ISO-8601; strings (not Date) so the type stays true after JSON round-trips (cache, SSE). */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class ProductPageResponse {
  @ApiProperty({ type: [ProductResponse] })
  items: ProductResponse[];

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Pass as `cursor` to fetch the next page; null on the last page.',
  })
  nextCursor: string | null;
}

// Fields are listed explicitly so new DB columns are never exposed by accident.
export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    quantity: product.quantity,
    price: product.price.toFixed(PRICE_DECIMAL_PLACES),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
