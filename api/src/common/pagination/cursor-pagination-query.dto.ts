import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '../constants';

export class CursorPaginationQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: PAGINATION_MAX_LIMIT,
    default: PAGINATION_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_MAX_LIMIT)
  limit: number = PAGINATION_DEFAULT_LIMIT;

  /** Id of the last item on the previous page. Validated so a malformed value is a 400, not a DB error. */
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      '`nextCursor` from the previous page. Omit for the first page.',
  })
  @IsOptional()
  @IsUUID('7')
  cursor?: string;
}
