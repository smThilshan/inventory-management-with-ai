import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PRICE_DECIMAL_PLACES,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_PRICE_MAX,
  PRODUCT_SKU_MAX_LENGTH,
  PRODUCT_SKU_PATTERN,
} from '../../common/constants';
import { Trim } from '../../common/transforms/trim.transform';

// Docs and validators read the same constants, so they cannot drift apart.
export class CreateProductDto {
  @ApiProperty({
    example: 'Mechanical Keyboard',
    maxLength: PRODUCT_NAME_MAX_LENGTH,
    description: 'Trimmed; must not be blank.',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRODUCT_NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({
    example: 'KB-MECH-001',
    maxLength: PRODUCT_SKU_MAX_LENGTH,
    pattern: PRODUCT_SKU_PATTERN.source,
    description: 'Unique. Uppercase letters, digits and single dashes.',
  })
  @IsString()
  @MaxLength(PRODUCT_SKU_MAX_LENGTH)
  @Matches(PRODUCT_SKU_PATTERN, {
    message:
      'sku must contain only uppercase letters, digits and single dashes (e.g. KB-MECH-001)',
  })
  sku: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    default: 0,
    example: 25,
    description:
      'Opening stock. Recorded as an IN movement so the ledger stays complete.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiProperty({
    example: 89.99,
    exclusiveMinimum: true,
    minimum: 0,
    maximum: PRODUCT_PRICE_MAX,
    multipleOf: 10 ** -PRICE_DECIMAL_PLACES,
    description: `JSON number with at most ${PRICE_DECIMAL_PLACES} decimal places; stored as Decimal(10,2).`,
  })
  @IsNumber({
    maxDecimalPlaces: PRICE_DECIMAL_PLACES,
    allowNaN: false,
    allowInfinity: false,
  })
  @IsPositive()
  @Max(PRODUCT_PRICE_MAX)
  price: number;
}
