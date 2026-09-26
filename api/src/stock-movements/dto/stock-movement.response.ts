import { ApiProperty } from '@nestjs/swagger';
import {
  MovementReason,
  MovementType,
  StockMovement,
} from '../../generated/prisma/client';
import {
  ProductResponse,
  toProductResponse,
} from '../../products/dto/product.response';
import type { StockMovementResult } from '../stock-ledger.service';

export class StockMovementResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ enum: MovementType, enumName: 'MovementType' })
  type: MovementType;

  @ApiProperty({ type: 'integer', minimum: 1, example: 3 })
  quantity: number;

  @ApiProperty({
    enum: MovementReason,
    enumName: 'MovementReason',
    description: 'PURCHASE/SALE link to an invoice; ADJUSTMENT never does.',
  })
  reason: MovementReason;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  invoiceId: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Order #1042' })
  note: string | null;

  /** ISO-8601 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class StockMovementResultResponse {
  @ApiProperty({
    type: ProductResponse,
    description: 'Product state after the movement.',
  })
  product: ProductResponse;

  @ApiProperty({
    type: StockMovementResponse,
    description: 'The ledger entry written.',
  })
  movement: StockMovementResponse;
}

export class MovementHistoryResponse {
  @ApiProperty({ type: [StockMovementResponse], description: 'Newest first.' })
  items: StockMovementResponse[];
}

export function toStockMovementResponse(
  movement: StockMovement,
): StockMovementResponse {
  return {
    id: movement.id,
    productId: movement.productId,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    invoiceId: movement.invoiceId,
    note: movement.note,
    createdAt: movement.createdAt.toISOString(),
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
