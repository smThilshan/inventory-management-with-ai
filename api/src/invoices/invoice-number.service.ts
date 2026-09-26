import { Injectable } from '@nestjs/common';
import { InvoiceType, Prisma } from '../generated/prisma/client';
import { formatInvoiceNumber, invoiceYear } from './invoice-number';

/**
 * Gap-free, per-type, per-year invoice numbers (PUR-2026-0001, SAL-2026-0001).
 *
 * One atomic statement creates the year's counter on first use or increments
 * it, and returns the new value. The row stays locked until the caller's
 * transaction ends, so concurrent invoices of the same type queue here and get
 * consecutive numbers; if the invoice transaction rolls back, so does the
 * increment, which is why numbers have no gaps.
 *
 * Why not Prisma's upsert: it only uses a native upsert in some cases and can
 * otherwise do SELECT-then-INSERT, which races on the first invoice of a year.
 */
@Injectable()
export class InvoiceNumberService {
  async next(
    tx: Prisma.TransactionClient,
    type: InvoiceType,
    date: Date,
  ): Promise<string> {
    const year = invoiceYear(date);
    // The id is internal to this table (never exposed), so the built-in
    // gen_random_uuid() is fine here.
    const [{ lastNumber }] = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO "InvoiceSequence" ("id", "type", "year", "lastNumber")
      VALUES (gen_random_uuid(), ${type}::"InvoiceType", ${year}, 1)
      ON CONFLICT ("type", "year")
      DO UPDATE SET "lastNumber" = "InvoiceSequence"."lastNumber" + 1
      RETURNING "lastNumber"
    `;
    return formatInvoiceNumber(type, year, lastNumber);
  }
}
