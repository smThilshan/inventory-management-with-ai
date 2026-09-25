import { ApiProperty } from '@nestjs/swagger';
import { StockMovementResponse } from '../dto/stock-movement.response';

/** Single source of truth for the event name; listeners import it rather than repeating the string. */
export const STOCK_UPDATED_EVENT = 'stock.updated';

/**
 * Emitted only after the DB transaction commits, so listeners never observe a
 * change that could still roll back. JSON-safe: it is streamed to browsers as-is,
 * which is why it is a documented class (part of the public SSE contract).
 */
export class StockUpdatedEvent {
  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'KB-MECH-001' })
  sku: string;

  /** Product quantity after the movement was applied. */
  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 44,
    description: 'Product quantity after the movement was applied.',
  })
  quantity: number;

  @ApiProperty({ type: StockMovementResponse })
  movement: StockMovementResponse;
}
