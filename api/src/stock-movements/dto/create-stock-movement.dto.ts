import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MOVEMENT_MAX_QUANTITY,
  MOVEMENT_NOTE_MAX_LENGTH,
} from '../../common/constants';
import { Trim } from '../../common/transforms/trim.transform';
import { MovementType } from '../../generated/prisma/client';

export class CreateStockMovementDto {
  @IsUUID('7')
  productId: string;

  @IsEnum(MovementType)
  type: MovementType;

  @IsInt()
  @Min(1)
  @Max(MOVEMENT_MAX_QUANTITY)
  quantity: number;

  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MOVEMENT_NOTE_MAX_LENGTH)
  note?: string;
}
