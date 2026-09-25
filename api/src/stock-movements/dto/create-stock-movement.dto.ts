import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    format: 'uuid',
    example: '01a0d808-8133-756c-91ec-f48e7e50d3c8',
  })
  @IsUUID('7')
  productId: string;

  @ApiProperty({
    enum: MovementType,
    // A named schema, so generated clients share one MovementType type.
    enumName: 'MovementType',
    description:
      'IN adds stock; OUT removes it and is rejected (409) if it would go negative.',
  })
  @IsEnum(MovementType)
  type: MovementType;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: MOVEMENT_MAX_QUANTITY,
    example: 3,
  })
  @IsInt()
  @Min(1)
  @Max(MOVEMENT_MAX_QUANTITY)
  quantity: number;

  @ApiPropertyOptional({
    maxLength: MOVEMENT_NOTE_MAX_LENGTH,
    example: 'Order #1042',
    description: 'Trimmed; must not be blank when provided.',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MOVEMENT_NOTE_MAX_LENGTH)
  note?: string;
}
