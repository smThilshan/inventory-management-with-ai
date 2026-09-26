import { ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorResponse } from '../../common/swagger/error.response';

/** 409 body. The details are present for "Insufficient stock" (OUT), absent for an IN overflow. */
export class InsufficientStockResponse extends ErrorResponse {
  @ApiPropertyOptional({ example: 'KB-MECH-001' })
  sku?: string;

  @ApiPropertyOptional({
    type: 'integer',
    example: 5,
    description: 'Quantity asked for.',
  })
  requested?: number;

  @ApiPropertyOptional({
    type: 'integer',
    example: 2,
    description: 'Stock available at the time of the request.',
  })
  available?: number;
}
