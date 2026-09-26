import { BadRequestException } from '@nestjs/common';
import { formatCalendarDate } from '../common/calendar-date';
import { resolveInvoiceDate } from './invoice-date';

// 21:00 UTC on 1 Jan = 01:00 on 2 Jan in Dubai (UTC+4).
const NOW = new Date('2026-01-01T21:00:00Z');
const resolve = (requested?: string, timeZone = 'Asia/Dubai') =>
  formatCalendarDate(resolveInvoiceDate(requested, timeZone, NOW));

describe('resolveInvoiceDate', () => {
  it('defaults to today in the business time zone', () => {
    expect(resolve()).toBe('2026-01-02');
  });

  it('accepts today and past dates as given', () => {
    expect(resolve('2026-01-02')).toBe('2026-01-02');
    expect(resolve('2025-06-30')).toBe('2025-06-30');
  });

  it('rejects dates after local today', () => {
    expect(() => resolve('2026-01-03')).toThrow(BadRequestException);
    expect(() => resolve('2026-01-03')).toThrow('today is 2026-01-02');
  });

  it('why the time zone matters: in UTC the same Dubai invoice would be "future"', () => {
    expect(() => resolve('2026-01-02', 'UTC')).toThrow(
      'must not be in the future',
    );
  });
});
