import { MovementType, StockMovement } from '../../generated/prisma/client';
import {
  ProductResponse,
  toProductResponse,
} from '../../products/dto/product.response';
import type { StockMovementResult } from '../stock-movements.service';

export interface StockMovementResponse {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  note: string | null;
  createdAt: Date;
}

export interface StockMovementResultResponse {
  product: ProductResponse;
  movement: StockMovementResponse;
}

export function toStockMovementResponse(
  movement: StockMovement,
): StockMovementResponse {
  return {
    id: movement.id,
    productId: movement.productId,
    type: movement.type,
    quantity: movement.quantity,
    note: movement.note,
    createdAt: movement.createdAt,
  };
}

export function toStockMovementResultResponse({
  product,
  movement,
}: StockMovementResult): StockMovementResultResponse {
  return {
    product: toProductResponse(product),
    movement: toStockMovementResponse(movement),
  };
}
