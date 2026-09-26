import {
  addDays,
  formatCalendarDate,
  parseCalendarDate,
  todayIn,
} from './calendar-date';

describe('calendar-date', () => {
  describe('todayIn', () => {
    it('uses the business time zone, not UTC', () => {
      const lateEveningUtc = new Date('2026-01-01T21:00:00Z'); // 01:00 on 2 Jan in Dubai

      expect(todayIn('Asia/Dubai', lateEveningUtc)).toBe('2026-01-02');
      expect(todayIn('UTC', lateEveningUtc)).toBe('2026-01-01');
    });

    it('crosses the year boundary in local time (affects the invoice-number year)', () => {
      expect(todayIn('Asia/Dubai', new Date('2026-12-31T20:30:00Z'))).toBe(
        '2027-01-01',
      );
    });
  });

  it('parse and format round-trip at UTC midnight', () => {
    const date = parseCalendarDate('2026-03-15');

    expect(date.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(formatCalendarDate(date)).toBe('2026-03-15');
  });

  describe('addDays', () => {
    it.each([
      ['2026-01-15', 30, '2026-02-14'],
      ['2026-12-15', 30, '2027-01-14'], // year boundary
      ['2028-02-15', 14, '2028-02-29'], // leap year
      ['2026-03-20', 30, '2026-04-19'], // across a DST change in other zones: unaffected
      ['2026-05-01', 0, '2026-05-01'],
    ])('%s + %i days = %s', (start, days, expected) => {
      expect(formatCalendarDate(addDays(parseCalendarDate(start), days))).toBe(
        expected,
      );
    });
  });
});
