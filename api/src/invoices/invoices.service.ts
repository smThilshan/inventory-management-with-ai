import { Injectable, NotFoundException } from '@nestjs/common';
import { Paginated, toPage } from '../common/pagination/paginated';
import { Invoice } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceWithDetails } from './dto/invoice.response';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';

/** Read side of invoicing. Invoices are only created via purchases and sales. */
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Newest first, keyset-paginated on the UUIDv7 id (time-ordered), so paging
   * stays stable while new invoices arrive. Filters are optional.
   */
  async findPage({
    limit,
    cursor,
    type,
    status,
  }: ListInvoicesQueryDto): Promise<Paginated<Invoice>> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        type,
        status,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    return toPage(rows, limit);
  }

  async findOne(id: string): Promise<InvoiceWithDetails> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        movements: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }
}
