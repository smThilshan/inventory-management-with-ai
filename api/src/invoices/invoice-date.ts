import { BadRequestException } from '@nestjs/common';
import { parseCalendarDate, todayIn } from '../common/calendar-date';

/**
 * The invoice date: the requested YYYY-MM-DD, or today in the business time
 * zone. Never in the future, judged by that same local "today".
 */
export function resolveInvoiceDate(
  requested: string | undefined,
  timeZone: string,
  now: Date = new Date(),
): Date {
  const today = todayIn(timeZone, now);
  const value = requested ?? today;
  // YYYY-MM-DD strings compare chronologically.
  if (value > today) {
    throw new BadRequestException(
      `date must not be in the future (today is ${today})`,
    );
  }
  return parseCalendarDate(value);
}
