import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createdInvoice, keyboard, monitor, mouse, settings } from '@/test/fixtures';
import { jsonResponse, mockFetch } from '@/test/mock-fetch';
import { SaleForm } from './SaleForm';

function renderForm() {
  const user = userEvent.setup();
  render(<SaleForm products={[keyboard, monitor, mouse]} settings={settings()} />);
  return user;
}

async function fillLine(
  user: ReturnType<typeof userEvent.setup>,
  n: number,
  productId: string,
  quantity: string,
) {
  await user.selectOptions(screen.getByLabelText(`Product for line ${n}`), productId);
  await user.type(screen.getByLabelText(`Quantity for line ${n}`), quantity);
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Create sales invoice' }));

describe('SaleForm', () => {
  it('shows available stock and catalogue price, and previews the total', async () => {
    const user = renderForm();

    expect(
      screen.getByRole('option', { name: 'Mechanical Keyboard (KB-MECH-001) · 45 in stock · AED 89.99' }),
    ).toBeInTheDocument();

    await fillLine(user, 1, keyboard.id, '2');
    expect(screen.getByRole('cell', { name: '89.99' })).toBeInTheDocument();
    expect(screen.getByTestId('preview-total')).toHaveTextContent('AED 179.98');
  });

  it('warns early when a line asks for more than is in stock', async () => {
    const user = renderForm();

    await fillLine(user, 1, monitor.id, '9'); // monitor has 8

    expect(screen.getByText('Only 8 in stock')).toBeInTheDocument();
  });

  it('on 409, lists exactly which products failed (requested vs available) and marks those lines', async () => {
    mockFetch(async () =>
      jsonResponse(409, {
        statusCode: 409,
        error: 'Conflict',
        message: 'Insufficient stock',
        shortages: [
          { productId: monitor.id, sku: monitor.sku, requested: 9, available: 8 },
          { productId: mouse.id, sku: mouse.sku, requested: 500, available: 120 },
        ],
      }),
    );
    const user = renderForm();

    await user.type(screen.getByLabelText('Customer'), 'Al Noor Trading');
    await fillLine(user, 1, keyboard.id, '1');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, monitor.id, '9');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 3, mouse.id, '500');
    await submit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Not enough stock. Nothing was saved.');
    const items = within(alert).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      '27" 4K Monitor (MN-4K-027): requested 9, only 8 available',
      'Wireless Mouse (MS-WL-002): requested 500, only 120 available',
    ]);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.hasAttribute('data-short'))).toEqual([false, true, true]);
    expect(screen.getByLabelText('Customer')).toHaveValue('Al Noor Trading'); // kept for correction
  });

  it('names unknown products on 404', async () => {
    mockFetch(async () =>
      jsonResponse(404, { statusCode: 404, message: 'Products not found', productIds: [mouse.id] }),
    );
    const user = renderForm();

    await user.type(screen.getByLabelText('Customer'), 'Buyer');
    await fillLine(user, 1, mouse.id, '1');
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some products no longer exist. Nothing was saved.Wireless Mouse',
    );
  });

  it('sends only product and quantity (the server prices the sale)', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse(201, createdInvoice({ type: 'SALE', invoiceNumber: 'SAL-2026-0003' })),
    );
    const user = renderForm();

    await user.type(screen.getByLabelText('Customer'), 'Buyer');
    await fillLine(user, 1, keyboard.id, '2');
    await submit(user);

    expect(await screen.findByRole('status')).toHaveTextContent('Invoice SAL-2026-0003 created');
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      customerName: 'Buyer',
      lines: [{ productId: keyboard.id, quantity: 2 }],
    });
  });
});
