import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client';
import { mapPrismaError } from './prisma-error.mapper';

/**
 * Lets services rely on DB constraints (e.g. the unique SKU index) instead of
 * racy "check then insert" logic, while clients still get a proper 4xx.
 * Unmapped errors fall through to Nest's default handler (logged, 500).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(
    error: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    super.catch(mapPrismaError(error) ?? error, host);
  }
}
