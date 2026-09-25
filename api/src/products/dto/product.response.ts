import { PRICE_DECIMAL_PLACES } from '../../common/constants';
import { Product } from '../../generated/prisma/client';

export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  /** Decimal as a fixed 2-dp string ("19.90") so clients never parse money into a float. */
  price: string;
  /** ISO-8601; strings (not Date) so the type stays true after JSON round-trips (cache, SSE). */
  createdAt: string;
  updatedAt: string;
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
