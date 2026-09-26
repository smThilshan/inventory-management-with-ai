import { Prisma } from '../generated/prisma/client';

type Decimal = Prisma.Decimal;

/**
 * Money input: a Decimal or a decimal string. Plain JS numbers are deliberately
 * not accepted: binary floats cannot represent most cents exactly
 * (1.005 rounds to 1.00, 0.1 + 0.2 !== 0.3).
 */
export type MoneyInput = Decimal | string;

export const MONEY_DECIMAL_PLACES = 2;
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

export interface LineInput {
  /** Positive integer. */
  quantity: number;
  unitPrice: MoneyInput;
}

export interface LineAmounts {
  quantity: number;
  unitPrice: Decimal;
  lineTotal: Decimal;
}

export interface InvoiceTotals {
  lines: LineAmounts[];
  subtotal: Decimal;
  taxRate: Decimal;
  taxAmount: Decimal;
  total: Decimal;
}

/** Rounds to cents, half-up (0.005 → 0.01), as invoices are conventionally rounded. */
export function roundMoney(value: MoneyInput): Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(
    MONEY_DECIMAL_PLACES,
    HALF_UP,
  );
}

/**
 * quantity × unitPrice. The unit price is rounded to cents FIRST, so the stored
 * line always equals quantity × the unit price printed on the invoice (and
 * satisfies the DB CHECK lineTotal = quantity * unitPrice). With an integer
 * quantity and a 2-dp price the product is exact: no further rounding needed.
 */
export function calculateLine({ quantity, unitPrice }: LineInput): LineAmounts {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError(
      `quantity must be a positive integer, got ${quantity}`,
    );
  }
  const price = roundMoney(unitPrice);
  return { quantity, unitPrice: price, lineTotal: price.times(quantity) };
}

export function sumMoney(values: Decimal[]): Decimal {
  return values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
}

/** Tax on the subtotal (not per line), rounded once, half-up. */
export function calculateTax(
  subtotal: MoneyInput,
  taxRate: MoneyInput,
): Decimal {
  return roundMoney(new Prisma.Decimal(subtotal).times(taxRate));
}

/**
 * subtotal = Σ lineTotal; taxAmount = round(subtotal × taxRate); total = subtotal + taxAmount.
 * Every value is exact to the cent, so total = subtotal + taxAmount holds exactly
 * (also enforced by a DB CHECK).
 */
export function calculateInvoiceTotals(
  lines: LineInput[],
  taxRate: MoneyInput,
): InvoiceTotals {
  const amounts = lines.map(calculateLine);
  const subtotal = sumMoney(amounts.map((line) => line.lineTotal));
  const taxAmount = calculateTax(subtotal, taxRate);
  return {
    lines: amounts,
    subtotal,
    taxRate: new Prisma.Decimal(taxRate),
    taxAmount,
    total: subtotal.plus(taxAmount),
  };
}

/** Fixed 2-dp string for API responses and PDFs ("19.90", never "19.9"). */
export function formatMoney(value: MoneyInput): string {
  return roundMoney(value).toFixed(MONEY_DECIMAL_PLACES);
}
