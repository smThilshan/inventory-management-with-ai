import { PRICE_DECIMAL_PLACES } from '../../common/constants';
import { Product } from '../../generated/prisma/client';

export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  /** Decimal as a fixed 2-dp string ("19.90") so clients never parse money into a float. */
  price: string;
  createdAt: Date;
  updatedAt: Date;
}

// Fields are listed explicitly so new DB columns are never exposed by accident.
export function toProductResponse(product: Product): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    quantity: product.quantity,
    price: product.price.toFixed(PRICE_DECIMAL_PLACES),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
