import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from '../../common/pagination/cursor-pagination-query.dto';
import { InvoiceStatus, InvoiceType } from '../../generated/prisma/client';

export class ListInvoicesQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ enum: InvoiceType, enumName: 'InvoiceType' })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}
