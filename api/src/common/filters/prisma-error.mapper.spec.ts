import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { mapPrismaError } from './prisma-error.mapper';

function prismaError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

const uniqueViolationOn = (index: string): Record<string, unknown> => ({
  driverAdapterError: { cause: { constraint: { index } } },
});

describe('mapPrismaError', () => {
  it('maps a SKU unique violation to 409 "SKU already exists"', () => {
    const result = mapPrismaError(
      prismaError('P2002', uniqueViolationOn('Product_sku_key')),
    );

    expect(result).toBeInstanceOf(ConflictException);
    expect(result?.message).toBe('SKU already exists');
  });

  it('falls back to a generic 409 for an unknown unique constraint', () => {
    const result = mapPrismaError(
      prismaError('P2002', uniqueViolationOn('Other_key')),
    );

    expect(result).toBeInstanceOf(ConflictException);
    expect(result?.message).toBe('Resource already exists');
  });

  it('maps a missing record to 404 using the model name', () => {
    const result = mapPrismaError(
      prismaError('P2025', { modelName: 'Product' }),
    );

    expect(result).toBeInstanceOf(NotFoundException);
    expect(result?.message).toBe('Product not found');
  });

  it('leaves unknown errors unmapped so they become a 500', () => {
    expect(mapPrismaError(prismaError('P2003'))).toBeUndefined();
  });
});
