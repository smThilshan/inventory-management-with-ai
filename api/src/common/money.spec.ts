import { Prisma } from '../generated/prisma/client';
import {
  calculateInvoiceTotals,
  calculateLine,
  calculateTax,
  formatMoney,
  roundMoney,
  sumMoney,
} from './money';

const d = (value: string) => new Prisma.Decimal(value);
const str = (value: Prisma.Decimal) => value.toFixed(2);

describe('money', () => {
  describe('roundMoney (half-up to cents)', () => {
    it.each([
      ['0.005', '0.01'], // half rounds up, not to even
      ['0.004', '0.00'],
      ['1.005', '1.01'], // a float gives 1.00 (1.005 is 1.00499999… in binary)
      ['2.675', '2.68'], // float toFixed gives 2.67
      ['0.015', '0.02'], // banker's rounding would give 0.02 too; 0.025 below differs
      ['0.025', '0.03'], // banker's (half-even) would give 0.02
      ['10', '10.00'],
    ])('%s → %s', (input, expected) => {
      expect(str(roundMoney(input))).toBe(expected);
    });

    it('is exact where floats are not (0.1 + 0.2)', () => {
      expect(str(sumMoney([d('0.1'), d('0.2')]))).toBe('0.30');
      expect(sumMoney([d('0.1'), d('0.2')]).equals(d('0.3'))).toBe(true);
    });
  });

  describe('calculateLine', () => {
    it('multiplies quantity by unit price exactly', () => {
      const line = calculateLine({ quantity: 3, unitPrice: '19.99' });

      expect(str(line.unitPrice)).toBe('19.99');
      expect(str(line.lineTotal)).toBe('59.97');
    });

    it('rounds the unit price to cents first, so the line matches the printed price', () => {
      const line = calculateLine({ quantity: 3, unitPrice: '33.333' });

      expect(str(line.unitPrice)).toBe('33.33');
      expect(str(line.lineTotal)).toBe('99.99'); // 3 × 33.33, not 3 × 33.333 = 100.00
    });

    it('handles large quantities without precision loss', () => {
      const line = calculateLine({
        quantity: 1_000_000,
        unitPrice: '99999.99',
      });

      expect(str(line.lineTotal)).toBe('99999990000.00');
    });

    it.each([0, -1, 1.5])('rejects quantity %s', (quantity) => {
      expect(() => calculateLine({ quantity, unitPrice: '1.00' })).toThrow(
        RangeError,
      );
    });
  });

  describe('calculateTax (on the subtotal, rounded once)', () => {
    it.each([
      ['100.00', '0.05', '5.00'],
      ['10.10', '0.05', '0.51'], // 0.505 → 0.51 (half-up)
      ['10.09', '0.05', '0.50'], // 0.5045 → 0.50
      ['99.99', '0.05', '5.00'], // 4.9995 → 5.00
      ['123.45', '0', '0.00'], // tax disabled (the default)
      ['0.00', '0.05', '0.00'],
    ])('%s × %s = %s', (subtotal, rate, expected) => {
      expect(str(calculateTax(subtotal, rate))).toBe(expected);
    });
  });

  describe('calculateInvoiceTotals', () => {
    it('with tax disabled (0%, the default): total = subtotal', () => {
      const totals = calculateInvoiceTotals(
        [
          { quantity: 2, unitPrice: '10.50' },
          { quantity: 1, unitPrice: '4.99' },
        ],
        '0',
      );

      expect(str(totals.subtotal)).toBe('25.99');
      expect(str(totals.taxAmount)).toBe('0.00');
      expect(str(totals.total)).toBe('25.99');
    });

    it('with 5% VAT', () => {
      const totals = calculateInvoiceTotals(
        [
          { quantity: 2, unitPrice: '10.50' },
          { quantity: 1, unitPrice: '4.99' },
        ],
        '0.05',
      );

      expect(str(totals.subtotal)).toBe('25.99');
      expect(str(totals.taxAmount)).toBe('1.30'); // 1.2995 → 1.30
      expect(str(totals.total)).toBe('27.29');
      expect(totals.taxRate.toString()).toBe('0.05');
    });

    it('three lines of 33.333: each line is rounded to cents, so the subtotal is 99.99', () => {
      const totals = calculateInvoiceTotals(
        [1, 2, 3].map(() => ({ quantity: 1, unitPrice: '33.333' })),
        '0.05',
      );

      expect(totals.lines.map((line) => str(line.lineTotal))).toEqual([
        '33.33',
        '33.33',
        '33.33',
      ]);
      expect(str(totals.subtotal)).toBe('99.99');
      expect(str(totals.taxAmount)).toBe('5.00');
      expect(str(totals.total)).toBe('104.99');
    });

    it('keeps the invariants the database also enforces', () => {
      const totals = calculateInvoiceTotals(
        [
          { quantity: 7, unitPrice: '0.07' },
          { quantity: 13, unitPrice: '1.13' },
          { quantity: 1, unitPrice: '999.995' },
        ],
        '0.0725',
      );

      for (const line of totals.lines) {
        expect(line.lineTotal.equals(line.unitPrice.times(line.quantity))).toBe(
          true,
        );
      }
      expect(totals.total.equals(totals.subtotal.plus(totals.taxAmount))).toBe(
        true,
      );
      expect(totals.total.decimalPlaces()).toBeLessThanOrEqual(2);
    });
  });

  it('formatMoney always prints 2 decimals', () => {
    expect(formatMoney('19.9')).toBe('19.90');
    expect(formatMoney(d('5'))).toBe('5.00');
    expect(formatMoney('0.005')).toBe('0.01');
  });
});
