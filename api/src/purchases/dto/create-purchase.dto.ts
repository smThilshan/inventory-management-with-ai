import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsPositive,
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
  INVOICE_UNIT_PRICE_MAX,
  MOVEMENT_MAX_QUANTITY,
  PRICE_DECIMAL_PLACES,
} from '../../common/constants';
import { InvoiceDateField } from '../../common/dto/invoice-date.dto';
import { Trim } from '../../common/transforms/trim.transform';

export class PurchaseLineDto {
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
    example: 10,
  })
  @IsInt()
  @Min(1)
  @Max(MOVEMENT_MAX_QUANTITY)
  quantity: number;

  @ApiProperty({
    example: 45,
    exclusiveMinimum: true,
    minimum: 0,
    maximum: INVOICE_UNIT_PRICE_MAX,
    multipleOf: 10 ** -PRICE_DECIMAL_PLACES,
    description: `Supplier's unit cost; JSON number with at most ${PRICE_DECIMAL_PLACES} decimal places.`,
  })
  @IsNumber({
    maxDecimalPlaces: PRICE_DECIMAL_PLACES,
    allowNaN: false,
    allowInfinity: false,
  })
  @IsPositive()
  @Max(INVOICE_UNIT_PRICE_MAX)
  unitCost: number;
}

export class CreatePurchaseDto {
  @ApiProperty({
    example: 'Acme Supplies LLC',
    minLength: COUNTERPARTY_NAME_MIN_LENGTH,
    maxLength: COUNTERPARTY_NAME_MAX_LENGTH,
  })
  @Trim()
  @IsString()
  @Length(COUNTERPARTY_NAME_MIN_LENGTH, COUNTERPARTY_NAME_MAX_LENGTH)
  supplierName: string;

  @InvoiceDateField()
  date?: string;

  @ApiProperty({
    type: [PurchaseLineDto],
    minItems: 1,
    maxItems: INVOICE_MAX_LINES,
    description:
      'Each product at most once; line order becomes the invoice line numbers.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(INVOICE_MAX_LINES)
  @ArrayUnique((line: PurchaseLineDto) => line.productId, {
    message: 'lines must not contain the same productId more than once',
  })
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines: PurchaseLineDto[];
}
