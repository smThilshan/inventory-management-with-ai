import { ConflictException, HttpStatus } from '@nestjs/common';

export interface StockShortage {
  productId: string;
  sku: string;
  requested: number;
  available: number;
}

/**
 * 409 for a sale where one or more lines lack stock. Lists EVERY short line
 * (not just the first) so the user can fix the whole order in one go.
 * Thrown inside the transaction, so nothing is saved.
 */
export class StockShortageException extends ConflictException {
  constructor(readonly shortages: StockShortage[]) {
    super({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'Insufficient stock',
      shortages,
    });
  }
}
