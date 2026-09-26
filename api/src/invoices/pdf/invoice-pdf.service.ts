import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import type { InvoiceWithLines } from '../dto/invoice.response';
import {
  INVOICE_CREATED_EVENT,
  type InvoiceCreatedEvent,
} from '../events/invoice-created.event';
import { InvoiceSettings } from '../invoice-settings';
import { renderInvoicePdf } from './invoice-pdf.renderer';

export interface InvoicePdf {
  /** Download name shown to users, e.g. "PUR-2026-0001.pdf". */
  fileName: string;
  content: Buffer;
}

/**
 * The PDF is a derived artifact: the database is the source of truth. Files
 * are generated after commit and served from disk, and regenerated on demand
 * if missing. Rendering is deterministic, so a regenerated file is identical.
 */
@Injectable()
export class InvoicePdfService implements OnModuleDestroy {
  private readonly logger = new Logger(InvoicePdfService.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: InvoiceSettings,
  ) {}

  /**
   * Fire-and-forget: the purchase/sale response does not wait for rendering,
   * and a failure here is logged but can never affect the committed invoice.
   */
  @OnEvent(INVOICE_CREATED_EVENT)
  onInvoiceCreated(event: InvoiceCreatedEvent): void {
    const task = this.generate(event.id)
      .catch((error: unknown) =>
        this.logger.error(
          `PDF generation failed for ${event.invoiceNumber}; it will be regenerated on request`,
          error instanceof Error ? error.stack : String(error),
        ),
      )
      .finally(() => this.inFlight.delete(task));
    this.inFlight.add(task);
  }

  async getPdf(invoiceId: string): Promise<InvoicePdf> {
    const invoice = await this.findInvoice(invoiceId);
    const content =
      (await this.readStored(invoice)) ?? (await this.renderAndStore(invoice));
    return { fileName: `${invoice.invoiceNumber}.pdf`, content };
  }

  /** Let pending generations finish before the DB connection closes. */
  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  private async generate(invoiceId: string): Promise<void> {
    await this.renderAndStore(await this.findInvoice(invoiceId));
  }

  private async findInvoice(invoiceId: string): Promise<InvoiceWithLines> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /**
   * The stored file is only a cache: ANY failure to read it (missing, or a
   * broken storage path) falls back to rendering from the database, so a
   * storage problem can never stop an invoice PDF from being served.
   */
  private async readStored(invoice: InvoiceWithLines): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(invoice));
    } catch (error: unknown) {
      if (!isMissingFile(error)) {
        this.logger.warn(
          `Could not read stored PDF for ${invoice.invoiceNumber}, regenerating: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }

  /**
   * Stores atomically (temp file + rename) so a concurrent reader never sees
   * a half-written PDF. If storing fails the PDF is still returned: the file
   * is only a cache of what the database can always reproduce.
   */
  private async renderAndStore(invoice: InvoiceWithLines): Promise<Buffer> {
    const content = await renderInvoicePdf(invoice);
    const target = this.pathFor(invoice);
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await mkdir(this.storageDir(), { recursive: true });
      await writeFile(temp, content);
      await rename(temp, target);
    } catch (error: unknown) {
      await rm(temp, { force: true }).catch(() => undefined);
      this.logger.warn(
        `Could not store PDF for ${invoice.invoiceNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return content;
  }

  /**
   * The id is part of the name because invoice numbers restart after a DB
   * reset: a stale "PUR-2026-0001.pdf" must never be served for a different invoice.
   */
  private pathFor(invoice: InvoiceWithLines): string {
    return join(
      this.storageDir(),
      `${invoice.invoiceNumber}_${invoice.id}.pdf`,
    );
  }

  private storageDir(): string {
    return resolve(this.settings.storageDir);
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
