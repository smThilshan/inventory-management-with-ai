import { ConflictException, HttpStatus } from '@nestjs/common';

/**
 * 409 for an OUT larger than the available stock. The message stays the stable
 * "Insufficient stock"; sku/requested/available are structured fields so clients
 * (and multi-line sales) can report exactly what failed without parsing text.
 */
export class InsufficientStockException extends ConflictException {
  constructor(
    readonly sku: string,
    readonly requested: number,
    readonly available: number,
  ) {
    super({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'Insufficient stock',
      sku,
      requested,
      available,
    });
  }
}
