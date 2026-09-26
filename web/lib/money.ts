/**
 * Client-side money for PREVIEWS only (the server is authoritative). Mirrors
 * the API's rules exactly: unit prices in cents, tax on the subtotal rounded
 * once half-up. Uses integer cents in BigInt: JS floats get cents wrong
 * (1.005 → 1.00) and lose precision on large totals.
 */

const CENTS_PER_UNIT = BigInt(100);
const RATE_SCALE = BigInt(10_000); // tax rates have up to 4 decimals
const HALF_RATE_SCALE = RATE_SCALE / BigInt(2);
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const RATE_PATTERN = /^\d+(\.\d{1,4})?$/;

/** "12.5" → 1250 cents; null if not a non-negative amount with at most 2 decimals. */
export function parseCents(value: string): bigint | null {
  const text = value.trim();
  if (!MONEY_PATTERN.test(text)) return null;
  const [units, fraction = ''] = text.split('.');
  return BigInt(units) * CENTS_PER_UNIT + BigInt(fraction.padEnd(2, '0'));
}

/** 1250 cents → "12.50" */
export function formatCents(cents: bigint): string {
  const units = cents / CENTS_PER_UNIT;
  const fraction = (cents % CENTS_PER_UNIT).toString().padStart(2, '0');
  return `${units}.${fraction}`;
}

/** Tax on the subtotal, rounded half-up to the cent ("0.05" → 5%). */
export function taxCents(subtotal: bigint, taxRate: string): bigint {
  if (!RATE_PATTERN.test(taxRate)) {
    throw new RangeError(`Invalid tax rate "${taxRate}"`);
  }
  const [units, fraction = ''] = taxRate.split('.');
  const scaledRate = BigInt(units) * RATE_SCALE + BigInt(fraction.padEnd(4, '0'));
  return (subtotal * scaledRate + HALF_RATE_SCALE) / RATE_SCALE;
}

export interface PreviewLine {
  quantity: number;
  /** Decimal string, e.g. a typed unit cost or a product price. */
  unitPrice: string;
}

export interface TotalsPreview {
  lineTotals: string[];
  subtotal: string;
  tax: string;
  total: string;
}

/** One line's total, or null while its quantity or price is incomplete. */
export function previewLineTotal({ quantity, unitPrice }: PreviewLine): string | null {
  const price = parseCents(unitPrice);
  if (price === null || !Number.isInteger(quantity) || quantity < 1) return null;
  return formatCents(price * BigInt(quantity));
}

/** null while any line is incomplete (no valid quantity or price yet). */
export function previewTotals(
  lines: PreviewLine[],
  taxRate: string,
): TotalsPreview | null {
  const lineCents: bigint[] = [];
  for (const line of lines) {
    const price = parseCents(line.unitPrice);
    if (price === null || !Number.isInteger(line.quantity) || line.quantity < 1) {
      return null;
    }
    lineCents.push(price * BigInt(line.quantity));
  }
  const subtotal = lineCents.reduce((sum, cents) => sum + cents, BigInt(0));
  const tax = taxCents(subtotal, taxRate);
  return {
    lineTotals: lineCents.map(formatCents),
    subtotal: formatCents(subtotal),
    tax: formatCents(tax),
    total: formatCents(subtotal + tax),
  };
}

/** "0.05" → "5", "0.075" → "7.5"; for labels like "Tax (5%)". */
export function formatPercent(taxRate: string): string {
  const scaled = Number(taxCents(BigInt(1_000_000), taxRate)) / 10_000;
  return String(scaled);
}

export const isZeroRate = (taxRate: string): boolean => /^0+(\.0*)?$/.test(taxRate);
