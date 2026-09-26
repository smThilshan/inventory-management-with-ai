import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';

/**
 * Invoicing configuration, read once at startup. A dedicated provider (rather
 * than ConfigService everywhere) gives one typed place for these values and
 * lets tests swap them, e.g. to issue invoices with 5% VAT.
 */
@Injectable()
export class InvoiceSettings {
  /** Decimal string, e.g. "0" or "0.05": never a float. */
  readonly taxRate: string;
  readonly currency: string;
  readonly dueDays: number;
  readonly timeZone: string;
  readonly companyName: string;
  readonly companyAddress: string;
  readonly storageDir: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.taxRate = config.get('TAX_RATE', { infer: true });
    this.currency = config.get('CURRENCY', { infer: true });
    this.dueDays = config.get('INVOICE_DUE_DAYS', { infer: true });
    this.timeZone = config.get('BUSINESS_TIMEZONE', { infer: true });
    this.companyName = config.get('COMPANY_NAME', { infer: true });
    this.companyAddress = config.get('COMPANY_ADDRESS', { infer: true });
    this.storageDir = config.get('INVOICE_STORAGE_DIR', { infer: true });
  }
}
