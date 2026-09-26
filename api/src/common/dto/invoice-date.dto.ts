import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, Matches } from 'class-validator';
import { CALENDAR_DATE_PATTERN } from '../constants';

/**
 * Optional invoice date as YYYY-MM-DD: a real calendar day (2026-02-30 is
 * rejected). "Not in the future" is checked by the issuer, which knows the
 * business time zone.
 */
export const InvoiceDateField = (): PropertyDecorator =>
  applyDecorators(
    ApiPropertyOptional({
      format: 'date',
      example: '2026-09-25',
      description:
        'Invoice date (YYYY-MM-DD). Defaults to today in the business time zone; must not be in the future.',
    }),
    IsOptional(),
    Matches(CALENDAR_DATE_PATTERN, {
      message: 'date must be in YYYY-MM-DD format',
    }),
    IsISO8601(
      { strict: true },
      { message: 'date must be a valid calendar date' },
    ),
  );
