import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { API_TAGS } from '../swagger.setup';
import {
  InvoiceDetailResponse,
  InvoicePageResponse,
  toInvoiceDetailResponse,
  toInvoiceSummary,
} from './dto/invoice.response';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './pdf/invoice-pdf.service';

const uuidV7 = new ParseUUIDPipe({ version: '7' });

@ApiTags(API_TAGS.invoicing)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: InvoicePdfService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listInvoices',
    summary: 'List invoices, newest first (cursor pagination)',
  })
  @ApiOkResponse({ type: InvoicePageResponse })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid filter, limit or cursor')
  async findPage(
    @Query() query: ListInvoicesQueryDto,
  ): Promise<InvoicePageResponse> {
    const page = await this.invoicesService.findPage(query);
    return { ...page, items: page.items.map(toInvoiceSummary) };
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getInvoice',
    summary: 'One invoice with its lines and linked stock movements',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceDetailResponse })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Malformed id')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Invoice not found')
  async findOne(
    @Param('id', uuidV7) id: string,
  ): Promise<InvoiceDetailResponse> {
    return toInvoiceDetailResponse(await this.invoicesService.findOne(id));
  }

  @Get(':id/pdf')
  @ApiOperation({
    operationId: 'getInvoicePdf',
    summary: 'The invoice as a PDF (regenerated if the stored file is missing)',
    description:
      'Text-based A4 PDF (standard fonts, no images), designed to be read by people and by an LLM.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Malformed id')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Invoice not found')
  async pdf(@Param('id', uuidV7) id: string): Promise<StreamableFile> {
    const { fileName, content } = await this.pdfService.getPdf(id);
    return new StreamableFile(content, {
      type: 'application/pdf',
      disposition: `inline; filename="${fileName}"`,
      length: content.length,
    });
  }
}
