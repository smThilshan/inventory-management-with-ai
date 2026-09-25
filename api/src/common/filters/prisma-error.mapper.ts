import {
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

const PrismaErrorCode = {
  UniqueConstraintViolation: 'P2002',
  RecordNotFound: 'P2025',
} as const;

/** User-facing messages per unique index. Add an entry when adding a unique constraint. */
const UNIQUE_CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  Product_sku_key: 'SKU already exists',
};

const DEFAULT_CONFLICT_MESSAGE = 'Resource already exists';

/**
 * Translates known Prisma errors into HTTP exceptions.
 * Returns undefined for anything unrecognised so it surfaces as a 500.
 */
export function mapPrismaError(
  error: Prisma.PrismaClientKnownRequestError,
): HttpException | undefined {
  switch (error.code) {
    case PrismaErrorCode.UniqueConstraintViolation: {
      const constraint = getViolatedConstraint(error.meta);
      return new ConflictException(
        (constraint && UNIQUE_CONSTRAINT_MESSAGES[constraint]) ??
          DEFAULT_CONFLICT_MESSAGE,
      );
    }
    case PrismaErrorCode.RecordNotFound: {
      const model = error.meta?.modelName;
      return new NotFoundException(
        `${typeof model === 'string' ? model : 'Resource'} not found`,
      );
    }
    default:
      return undefined;
  }
}

// With driver adapters (Prisma 7), the index name lives at
// meta.driverAdapterError.cause.constraint.index rather than meta.target.
function getViolatedConstraint(
  meta: Record<string, unknown> | undefined,
): string | undefined {
  const adapterError = asRecord(meta?.driverAdapterError);
  const cause = asRecord(adapterError?.cause);
  const constraint = asRecord(cause?.constraint);
  const index = constraint?.index;
  return typeof index === 'string' ? index : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
