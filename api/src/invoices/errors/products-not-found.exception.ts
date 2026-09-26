import { HttpStatus, NotFoundException } from '@nestjs/common';

/** 404 that lists every unknown product id at once, so the client can fix them in one go. */
export class ProductsNotFoundException extends NotFoundException {
  constructor(readonly productIds: string[]) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'Not Found',
      message: 'Products not found',
      productIds,
    });
  }
}
