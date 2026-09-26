import {
  formatCents,
  formatPercent,
  isZeroRate,
  parseCents,
  previewTotals,
  taxCents,
} from './money';

// Expected values match the API's money.spec.ts: preview and server must agree.
describe('client money (previews)', () => {
  it.each([
    ['12.5', '12.50'],
    ['0', '0.00'],
    ['0.01', '0.01'],
    ['99999999.99', '99999999.99'],
  ])('parses and formats %s as %s', (input, expected) => {
    expect(formatCents(parseCents(input) as bigint)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '-5', '1,000.00', '.5'])(
    'rejects "%s"',
    (input) => {
      expect(parseCents(input)).toBeNull();
    },
  );

  it.each([
    ['10.10', '0.05', '0.51'], // 0.505 → half-up
    ['10.09', '0.05', '0.50'], // 0.5045
    ['99.99', '0.05', '5.00'], // 4.9995
    ['25.99', '0.05', '1.30'], // 1.2995
    ['762.50', '0.075', '57.19'], // 57.1875
    ['123.45', '0', '0.00'],
  ])('tax on %s at %s = %s', (subtotal, rate, expected) => {
    expect(formatCents(taxCents(parseCents(subtotal) as bigint, rate))).toBe(expected);
  });

  it('previews line totals, subtotal, tax and total like the server', () => {
    expect(
      previewTotals(
        [
          { quantity: 2, unitPrice: '10.50' },
          { quantity: 1, unitPrice: '4.99' },
        ],
        '0.05',
      ),
    ).toEqual({ lineTotals: ['21.00', '4.99'], subtotal: '25.99', tax: '1.30', total: '27.29' });
  });

  it('stays exact where floats drift (0.1 + 0.2, large totals)', () => {
    expect(
      previewTotals(
        [
          { quantity: 1, unitPrice: '0.1' },
          { quantity: 1, unitPrice: '0.2' },
        ],
        '0',
      )?.total,
    ).toBe('0.30');
    expect(previewTotals([{ quantity: 1_000_000, unitPrice: '99999.99' }], '0.05')?.total).toBe(
      '104999989500.00',
    );
  });

  it('returns null while a line is incomplete', () => {
    expect(previewTotals([{ quantity: 1, unitPrice: '' }], '0')).toBeNull();
    expect(previewTotals([{ quantity: 0, unitPrice: '1.00' }], '0')).toBeNull();
  });

  it('formats rates for labels and detects a disabled tax', () => {
    expect(formatPercent('0.05')).toBe('5');
    expect(formatPercent('0.075')).toBe('7.5');
    expect(isZeroRate('0')).toBe(true);
    expect(isZeroRate('0.0000')).toBe(true);
    expect(isZeroRate('0.05')).toBe(false);
  });
});
