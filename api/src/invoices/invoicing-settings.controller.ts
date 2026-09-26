import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { todayIn } from '../common/calendar-date';
import { API_TAGS } from '../swagger.setup';
import { InvoicingSettingsResponse } from './dto/invoicing-settings.response';
import { InvoiceSettings } from './invoice-settings';

@ApiTags(API_TAGS.invoicing)
@Controller('invoicing')
export class InvoicingSettingsController {
  constructor(private readonly settings: InvoiceSettings) {}

  /** Lets the UI preview totals with the server's tax rate instead of a duplicated env var. */
  @Get('settings')
  @ApiOperation({
    operationId: 'getInvoicingSettings',
    summary: 'Tax rate, currency and payment terms used for new invoices',
  })
  @ApiOkResponse({ type: InvoicingSettingsResponse })
  getSettings(): InvoicingSettingsResponse {
    return {
      taxRate: this.settings.taxRate,
      currency: this.settings.currency,
      dueDays: this.settings.dueDays,
      // Same rule the server validates with, so the UI never offers a date it would reject.
      today: todayIn(this.settings.timeZone),
    };
  }
}
