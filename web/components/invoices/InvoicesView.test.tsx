import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { INVOICE_CREATED_EVENT } from '@/lib/constants';
import { invoiceCreated, invoiceSummary } from '@/test/fixtures';
import { MockEventSource } from '@/test/mock-event-source';
import { jsonResponse, mockFetch } from '@/test/mock-fetch';
import type { InvoicePage } from '@/lib/types';
import { InvoicesView } from './InvoicesView';

const existing = invoiceSummary();
const firstPage: InvoicePage = { items: [existing], nextCursor: null };

const invoiceRows = () => screen.getAllByRole('row').slice(1);
const numbers = () => invoiceRows().map((row) => within(row).getAllByRole('cell')[0].textContent);

async function renderLive() {
  const view = render(<InvoicesView initialPage={firstPage} />);
  const source = MockEventSource.latest();
  await act(async () => source.open()); // triggers a resync
  return { ...view, source };
}

describe('InvoicesView', () => {
  beforeEach(() => {
    MockEventSource.install();
    mockFetch(async () => jsonResponse(200, firstPage));
  });

  it('renders number, type, party, date, total and status', () => {
    render(<InvoicesView initialPage={firstPage} />);

    const row = invoiceRows()[0];
    expect(row).toHaveTextContent('PUR-2026-0001');
    expect(row).toHaveTextContent('Purchase');
    expect(row).toHaveTextContent('Gulf Tech Distributors');
    expect(row).toHaveTextContent('2026-09-25');
    expect(row).toHaveTextContent('AED 762.50');
    expect(row).toHaveTextContent('Not sent');
  });

  it('adds a new row live on invoice.created, newest first, highlighted', async () => {
    const { source } = await renderLive();

    act(() => source.emit(INVOICE_CREATED_EVENT, invoiceCreated()));

    expect(numbers()).toEqual(['SAL-2026-0007', 'PUR-2026-0001']);
    expect(invoiceRows()[0]).toHaveAttribute('data-changed', 'true');
    expect(invoiceRows()[0]).toHaveTextContent('Sale');
    expect(invoiceRows()[0]).toHaveTextContent('AED 187.99');
  });

  it('does not duplicate an invoice that is delivered twice', async () => {
    const { source } = await renderLive();

    act(() => source.emit(INVOICE_CREATED_EVENT, invoiceCreated()));
    act(() => source.emit(INVOICE_CREATED_EVENT, invoiceCreated()));

    expect(numbers()).toEqual(['SAL-2026-0007', 'PUR-2026-0001']);
  });

  it('ignores live invoices that do not match the active filter', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(200, firstPage));
    const user = userEvent.setup();
    const { source } = await renderLive();

    await user.selectOptions(screen.getByLabelText('Type'), 'PURCHASE');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://api.test/invoices?type=PURCHASE&limit=20',
      expect.anything(),
    );

    act(() => source.emit(INVOICE_CREATED_EVENT, invoiceCreated({ type: 'SALE' })));
    expect(numbers()).toEqual(['PUR-2026-0001']);

    act(() =>
      source.emit(
        INVOICE_CREATED_EVENT,
        invoiceCreated({ id: '01a0d9f8-0000-7000-8000-0000000000aa', invoiceNumber: 'PUR-2026-0002', type: 'PURCHASE' }),
      ),
    );
    expect(numbers()).toEqual(['PUR-2026-0002', 'PUR-2026-0001']);
  });

  it('links to the PDF and keeps "Send to accounting" disabled for now', () => {
    render(<InvoicesView initialPage={firstPage} />);

    expect(screen.getByRole('link', { name: 'View PDF for PUR-2026-0001' })).toHaveAttribute(
      'href',
      `http://api.test/invoices/${existing.id}/pdf`,
    );
    const send = screen.getByRole('button', { name: /Send PUR-2026-0001 to accounting/ });
    expect(send).toBeDisabled();
    expect(send.parentElement).toHaveAttribute('title', 'Available in Task 2');
  });

  it('loads more with the cursor', async () => {
    const older = invoiceSummary({ id: '01a0d9f8-0000-7000-8000-000000000000', invoiceNumber: 'PUR-2025-0099' });
    const fetchMock = mockFetch(async () => jsonResponse(200, { items: [older], nextCursor: null }));
    const user = userEvent.setup();
    render(<InvoicesView initialPage={{ items: [existing], nextCursor: existing.id }} />);

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('PUR-2025-0099')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `http://api.test/invoices?cursor=${existing.id}&limit=20`,
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
