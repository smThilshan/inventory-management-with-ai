import { InvoiceType } from '../src/generated/prisma/client';
import { InvoiceNumberService } from '../src/invoices/invoice-number.service';
import { createTestApp, resetState, TestContext } from './utils/test-app';

const DATE_2026 = new Date('2026-06-15T00:00:00.000Z');
const DATE_2027 = new Date('2027-01-01T00:00:00.000Z');

/** Real Postgres: numbering guarantees depend on row locks and rollbacks. */
describe('Invoice numbering (integration)', () => {
  let ctx: TestContext;
  let numbers: InvoiceNumberService;

  beforeAll(async () => {
    ctx = await createTestApp();
    numbers = ctx.app.get(InvoiceNumberService);
  });

  beforeEach(async () => {
    await resetState(ctx);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  /** Takes a number inside its own committed transaction. */
  const take = (type: InvoiceType, date = DATE_2026) =>
    ctx.prisma.$transaction((tx) => numbers.next(tx, type, date));

  /** Takes a number, then rolls the transaction back. */
  const takeAndRollBack = (type: InvoiceType) =>
    ctx.prisma
      .$transaction(async (tx) => {
        await numbers.next(tx, type, DATE_2026);
        throw new Error('rollback');
      })
      .catch(() => undefined);

  it('starts at 0001 and increments', async () => {
    expect(await take(InvoiceType.PURCHASE)).toBe('PUR-2026-0001');
    expect(await take(InvoiceType.PURCHASE)).toBe('PUR-2026-0002');
    expect(await take(InvoiceType.PURCHASE)).toBe('PUR-2026-0003');
  });

  it('keeps separate sequences per type', async () => {
    expect(await take(InvoiceType.PURCHASE)).toBe('PUR-2026-0001');
    expect(await take(InvoiceType.SALE)).toBe('SAL-2026-0001');
    expect(await take(InvoiceType.PURCHASE)).toBe('PUR-2026-0002');
  });

  it('resets every year', async () => {
    expect(await take(InvoiceType.SALE, DATE_2026)).toBe('SAL-2026-0001');
    expect(await take(InvoiceType.SALE, DATE_2026)).toBe('SAL-2026-0002');
    expect(await take(InvoiceType.SALE, DATE_2027)).toBe('SAL-2027-0001');
  });

  it('does not consume a number when the transaction rolls back (gap-free)', async () => {
    expect(await take(InvoiceType.SALE)).toBe('SAL-2026-0001');

    await takeAndRollBack(InvoiceType.SALE);

    expect(await take(InvoiceType.SALE)).toBe('SAL-2026-0002');
  });

  it('10 concurrent transactions get 10 unique, consecutive numbers', async () => {
    const issued = await Promise.all(
      Array.from({ length: 10 }, () => take(InvoiceType.PURCHASE)),
    );

    expect([...issued].sort()).toEqual(
      Array.from(
        { length: 10 },
        (_, i) => `PUR-2026-${String(i + 1).padStart(4, '0')}`,
      ),
    );
  });

  it('stays gap-free when concurrent transactions roll back', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? take(InvoiceType.SALE)
          : takeAndRollBack(InvoiceType.SALE),
      ),
    );

    const committed = results
      .filter((n): n is string => n !== undefined)
      .sort();
    expect(committed).toEqual([
      'SAL-2026-0001',
      'SAL-2026-0002',
      'SAL-2026-0003',
      'SAL-2026-0004',
      'SAL-2026-0005',
    ]);
  });
});
