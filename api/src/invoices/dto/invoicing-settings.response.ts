import { ApiProperty } from '@nestjs/swagger';

/** What a client needs to preview invoice totals exactly like the server. */
export class InvoicingSettingsResponse {
  @ApiProperty({
    example: '0',
    description: 'Decimal fraction (0.05 = 5%); "0" when tax is disabled.',
  })
  taxRate: string;

  @ApiProperty({ example: 'AED', description: 'ISO 4217 code.' })
  currency: string;

  @ApiProperty({
    type: 'integer',
    example: 30,
    description: 'Invoice due date = date + dueDays.',
  })
  dueDays: number;

  @ApiProperty({
    format: 'date',
    example: '2026-09-25',
    description:
      'Today in the business time zone: the default and latest allowed invoice date.',
  })
  today: string;
}
