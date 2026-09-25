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

export class CreateProductDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRODUCT_NAME_MAX_LENGTH)
  name: string;

  @IsString()
  @MaxLength(PRODUCT_SKU_MAX_LENGTH)
  @Matches(PRODUCT_SKU_PATTERN, {
    message:
      'sku must contain only uppercase letters, digits and single dashes (e.g. KB-MECH-001)',
  })
  sku: string;

  /** Opening stock; recorded as an IN movement so the ledger stays complete. */
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsNumber({
    maxDecimalPlaces: PRICE_DECIMAL_PLACES,
    allowNaN: false,
    allowInfinity: false,
  })
  @IsPositive()
  @Max(PRODUCT_PRICE_MAX)
  price: number;
}
