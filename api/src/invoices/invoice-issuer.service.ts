import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { addDays } from '../common/calendar-date';
import {
  INVOICE_AMOUNT_MAX,
  INVOICE_TRANSACTION_TIMEOUT_MS,
} from '../common/constants';
import {
  calculateInvoiceTotals,
  InvoiceTotals,
  MoneyInput,
} from '../common/money';
import {
  InvoiceType,
  MovementReason,
  MovementType,
  Prisma,
  Product,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  STOCK_UPDATED_EVENT,
  toStockUpdatedEvent,
} from '../stock-movements/events/stock-updated.event';
import {
  StockLedgerService,
  StockMovementResult,
} from '../stock-movements/stock-ledger.service';
import { InvoiceWithLines } from './dto/invoice.response';
import { InsufficientStockException } from '../stock-movements/errors/insufficient-stock.exception';
import { ProductsNotFoundException } from './errors/products-not-found.exception';
import {
  StockShortage,
  StockShortageException,
} from './errors/stock-shortage.exception';
import {
  INVOICE_CREATED_EVENT,
  toInvoiceCreatedEvent,
} from './events/invoice-created.event';
import { resolveInvoiceDate } from './invoice-date';
import { InvoiceNumberService } from './invoice-number.service';
import { InvoiceSettings } from './invoice-settings';

/** How each invoice type moves stock. */
const STOCK_EFFECT: Readonly<
  Record<InvoiceType, { type: MovementType; reason: MovementReason }>
> = {
  PURCHASE: { type: MovementType.IN, reason: MovementReason.PURCHASE },
  SALE: { type: MovementType.OUT, reason: MovementReason.SALE },
};

interface LineRequest {
  productId: string;
  quantity: number;
}

/** Purchases carry the supplier's unit cost; sales are priced from the catalogue. */
export type IssueInvoiceInput =
  | {
      type: typeof InvoiceType.PURCHASE;
      counterpartyName: string;
      /** YYYY-MM-DD; defaults to today in the business time zone. */
      date?: string;
      lines: (LineRequest & { unitPrice: MoneyInput })[];
    }
  | {
      type: typeof InvoiceType.SALE;
      counterpartyName: string;
      date?: string;
      lines: LineRequest[];
    };

interface PricedLine {
  product: Product;
  quantity: number;
  unitPrice: MoneyInput;
}

interface IssuedInvoice {
  invoice: InvoiceWithLines;
  movements: StockMovementResult[];
}

// Any consistent global order works; all invoice transactions lock product
// rows in this order, so two invoices sharing products cannot deadlock.
const byProductId = (a: PricedLine, b: PricedLine): number =>
  a.product.id < b.product.id ? -1 : a.product.id > b.product.id ? 1 : 0;

/**
 * Issues a purchase or sale: 1 invoice = many lines = many stock movements,
 * all in ONE transaction (all-or-nothing). Events are published only after commit.
 */
@Injectable()
export class InvoiceIssuerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly numbers: InvoiceNumberService,
    private readonly settings: InvoiceSettings,
    private readonly events: EventEmitter2,
  ) {}

  async issue(input: IssueInvoiceInput): Promise<InvoiceWithLines> {
    // Validated before opening a transaction: a bad date costs no DB work.
    const date = resolveInvoiceDate(input.date, this.settings.timeZone);

    const { invoice, movements } = await this.prisma.$transaction(
      async (tx): Promise<IssuedInvoice> => {
        const lines = this.priceLines(
          input,
          await this.loadProducts(tx, input),
        );
        const totals = calculateInvoiceTotals(lines, this.settings.taxRate);
        this.assertWithinLimits(totals);

        // Taken as late as possible: the sequence row stays locked until commit.
        const invoiceNumber = await this.numbers.next(tx, input.type, date);
        const invoice = await this.createInvoice(tx, {
          input,
          invoiceNumber,
          date,
          lines,
          totals,
        });
        const movements = await this.applyMovements(
          tx,
          input.type,
          invoice.id,
          lines,
        );
        return { invoice, movements };
      },
      { timeout: INVOICE_TRANSACTION_TIMEOUT_MS },
    );

    await this.publish(invoice, movements);
    return invoice;
  }

  private async loadProducts(
    tx: Prisma.TransactionClient,
    input: IssueInvoiceInput,
  ): Promise<Map<string, Product>> {
    const ids = input.lines.map((line) => line.productId);
    const products = await tx.product.findMany({ where: { id: { in: ids } } });
    const byId = new Map(products.map((product) => [product.id, product]));

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new ProductsNotFoundException(missing);
    }
    return byId;
  }

  /** Keeps the submitted line order (it becomes the invoice's line numbers). */
  private priceLines(
    input: IssueInvoiceInput,
    products: Map<string, Product>,
  ): PricedLine[] {
    const productOf = (id: string): Product => products.get(id) as Product;
    return input.type === InvoiceType.PURCHASE
      ? input.lines.map((line) => ({
          product: productOf(line.productId),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        }))
      : input.lines.map((line) => {
          const product = productOf(line.productId);
          return { product, quantity: line.quantity, unitPrice: product.price };
        });
  }

  // Turns a would-be numeric overflow (a 500 from Postgres) into a clear 400.
  private assertWithinLimits(totals: InvoiceTotals): void {
    if (totals.total.greaterThan(INVOICE_AMOUNT_MAX)) {
      throw new BadRequestException(
        `Invoice total exceeds the maximum of ${INVOICE_AMOUNT_MAX}`,
      );
    }
  }

  private createInvoice(
    tx: Prisma.TransactionClient,
    params: {
      input: IssueInvoiceInput;
      invoiceNumber: string;
      date: Date;
      lines: PricedLine[];
      totals: InvoiceTotals;
    },
  ): Promise<InvoiceWithLines> {
    const { input, invoiceNumber, date, lines, totals } = params;
    return tx.invoice.create({
      data: {
        invoiceNumber,
        type: input.type,
        counterpartyName: input.counterpartyName,
        // Snapshot, like the lines: the issuer as of today, even if config changes later.
        companyName: this.settings.companyName,
        companyAddress: this.settings.companyAddress,
        date,
        dueDate: addDays(date, this.settings.dueDays),
        currency: this.settings.currency,
        subtotal: totals.subtotal,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        lines: {
          create: lines.map((line, index) => ({
            lineNumber: index + 1,
            productId: line.product.id,
            // Snapshots: the invoice never changes if the product is later edited.
            description: line.product.name,
            sku: line.product.sku,
            quantity: line.quantity,
            unitPrice: totals.lines[index].unitPrice,
            lineTotal: totals.lines[index].lineTotal,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /**
   * A refused OUT raises no SQL error (the conditional UPDATE just matches 0
   * rows), so the transaction stays usable: we keep going to find EVERY short
   * line, then throw once. Throwing rolls back the whole invoice, including
   * the lines that did succeed and the invoice number.
   */
  private async applyMovements(
    tx: Prisma.TransactionClient,
    type: InvoiceType,
    invoiceId: string,
    lines: PricedLine[],
  ): Promise<StockMovementResult[]> {
    const effect = STOCK_EFFECT[type];
    const results: StockMovementResult[] = [];
    const shortages: { lineIndex: number; shortage: StockShortage }[] = [];

    const inLockOrder = lines
      .map((line, lineIndex) => ({ line, lineIndex }))
      .sort((a, b) => byProductId(a.line, b.line));

    for (const { line, lineIndex } of inLockOrder) {
      try {
        results.push(
          await this.ledger.applyMovement(tx, {
            productId: line.product.id,
            type: effect.type,
            quantity: line.quantity,
            reason: effect.reason,
            invoiceId,
          }),
        );
      } catch (error: unknown) {
        if (!(error instanceof InsufficientStockException)) throw error;
        shortages.push({
          lineIndex,
          shortage: {
            productId: line.product.id,
            sku: error.sku,
            requested: error.requested,
            available: error.available,
          },
        });
      }
    }

    if (shortages.length > 0) {
      // Reported in the order the user entered the lines.
      throw new StockShortageException(
        shortages
          .sort((a, b) => a.lineIndex - b.lineIndex)
          .map(({ shortage }) => shortage),
      );
    }
    return results;
  }

  // After commit only. stock.updated reuses the adjustment payload, so SSE and
  // the low-stock cache invalidation work unchanged; invoice.created is also
  // the hook for PDF generation (Phase 6).
  private async publish(
    invoice: InvoiceWithLines,
    movements: StockMovementResult[],
  ): Promise<void> {
    await Promise.all(
      movements.map((result) =>
        this.events.emitAsync(STOCK_UPDATED_EVENT, toStockUpdatedEvent(result)),
      ),
    );
    await this.events.emitAsync(
      INVOICE_CREATED_EVENT,
      toInvoiceCreatedEvent(invoice),
    );
  }
}
