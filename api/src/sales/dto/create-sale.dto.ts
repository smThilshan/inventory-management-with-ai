import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  COUNTERPARTY_NAME_MAX_LENGTH,
  COUNTERPARTY_NAME_MIN_LENGTH,
  INVOICE_MAX_LINES,
  MOVEMENT_MAX_QUANTITY,
} from '../../common/constants';
import { InvoiceDateField } from '../../common/dto/invoice-date.dto';
import { Trim } from '../../common/transforms/trim.transform';

/** No price field: sales are priced from the catalogue (clients cannot set it). */
export class SaleLineDto {
  @ApiProperty({
    format: 'uuid',
    example: '01a0d808-8133-756c-91ec-f48e7e50d3c8',
  })
  @IsUUID('7')
  productId: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: MOVEMENT_MAX_QUANTITY,
    example: 2,
  })
  @IsInt()
  @Min(1)
  @Max(MOVEMENT_MAX_QUANTITY)
  quantity: number;
}

export class CreateSaleDto {
  @ApiProperty({
    example: 'Al Noor Trading',
    minLength: COUNTERPARTY_NAME_MIN_LENGTH,
    maxLength: COUNTERPARTY_NAME_MAX_LENGTH,
  })
  @Trim()
  @IsString()
  @Length(COUNTERPARTY_NAME_MIN_LENGTH, COUNTERPARTY_NAME_MAX_LENGTH)
  customerName: string;

  @InvoiceDateField()
  date?: string;

  @ApiProperty({
    type: [SaleLineDto],
    minItems: 1,
    maxItems: INVOICE_MAX_LINES,
    description:
      'Each product at most once; line order becomes the invoice line numbers.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(INVOICE_MAX_LINES)
  @ArrayUnique((line: SaleLineDto) => line.productId, {
    message: 'lines must not contain the same productId more than once',
  })
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines: SaleLineDto[];
}
