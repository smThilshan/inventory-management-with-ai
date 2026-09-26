import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createdInvoice, keyboard, monitor, settings } from '@/test/fixtures';
import { jsonResponse, mockFetch } from '@/test/mock-fetch';
import type { InvoicingSettings } from '@/lib/types';
import { PurchaseForm } from './PurchaseForm';

function renderForm(overrides: Partial<InvoicingSettings> = {}) {
  const user = userEvent.setup();
  render(<PurchaseForm products={[keyboard, monitor]} settings={settings(overrides)} />);
  return user;
}

const total = () => screen.getByTestId('preview-total');
const subtotal = () => screen.getByTestId('preview-subtotal');

async function fillLine(
  user: ReturnType<typeof userEvent.setup>,
  n: number,
  productId: string,
  quantity: string,
  unitCost: string,
) {
  await user.selectOptions(screen.getByLabelText(`Product for line ${n}`), productId);
  await user.type(screen.getByLabelText(`Quantity for line ${n}`), quantity);
  await user.type(screen.getByLabelText(`Unit cost for line ${n}`), unitCost);
}

describe('PurchaseForm', () => {
  it('computes line totals and the preview total as you type (tax disabled: no tax row)', async () => {
    const user = renderForm();
    expect(total()).toHaveTextContent('—');

    await fillLine(user, 1, keyboard.id, '10', '45');
    expect(screen.getByRole('cell', { name: '450.00' })).toBeInTheDocument();
    expect(total()).toHaveTextContent('AED 450.00');

    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, monitor.id, '25', '12.50');

    expect(subtotal()).toHaveTextContent('AED 762.50');
    expect(total()).toHaveTextContent('AED 762.50');
    expect(screen.queryByText(/^Tax/)).not.toBeInTheDocument();
  });

  it('adds tax to the preview when a rate is configured (half-up, like the server)', async () => {
    const user = renderForm({ taxRate: '0.05' });

    await fillLine(user, 1, keyboard.id, '2', '10.50');
    await user.click(screen.getByRole('button', { name: '+ Add line' }));
    await fillLine(user, 2, monitor.id, '1', '4.99');

    expect(screen.getByText('Tax (5%)')).toBeInTheDocument();
    expect(subtotal()).toHaveTextContent('AED 25.99');
    expect(total()).toHaveTextContent('AED 27.29'); // + 1.30 (1.2995 rounded half-up)
  });

  it('does not offer a product that is already on another line', async () => {
    const user = renderForm();

    await user.selectOptions(screen.getByLabelText('Product for line 1'), keyboard.id);
    await user.click(screen.getByRole('button', { name: '+ Add line' }));

    const optionIn = (line: number, productId: string) =>
      [...screen.getByLabelText(`Product for line ${line}`).querySelectorAll('option')].find(
        (option) => option.value === productId,
      );
    expect(optionIn(2, keyboard.id)).toBeDisabled();
    expect(optionIn(2, monitor.id)).toBeEnabled();
    expect(optionIn(1, keyboard.id)).toBeEnabled(); // still selectable where it is chosen
  });

  it('sends the purchase (no date unless changed) and shows the invoice with a PDF link, then resets', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse(201, createdInvoice({ id: 'inv-1', invoiceNumber: 'PUR-2026-0042', total: '450.00' })),
    );
    const user = renderForm();

    await user.type(screen.getByLabelText('Supplier'), '  Gulf Tech  ');
    await fillLine(user, 1, keyboard.id, '10', '45');
    await user.click(screen.getByRole('button', { name: 'Create purchase invoice' }));

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Invoice PUR-2026-0042 created');
    expect(screen.getByRole('link', { name: 'View PDF' })).toHaveAttribute(
      'href',
      'http://api.test/invoices/inv-1/pdf',
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/purchases');
    expect(JSON.parse(init?.body as string)).toEqual({
      supplierName: 'Gulf Tech',
      lines: [{ productId: keyboard.id, quantity: 10, unitCost: 45 }],
    });
    expect(screen.getByLabelText('Supplier')).toHaveValue('');
    expect(screen.getByLabelText('Quantity for line 1')).toHaveValue(null);
  });

  it('sends a date the user picked', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(201, createdInvoice()));
    const user = renderForm();

    await user.type(screen.getByLabelText('Supplier'), 'Gulf Tech');
    await user.clear(screen.getByLabelText('Invoice date'));
    await user.type(screen.getByLabelText('Invoice date'), '2026-09-01');
    await fillLine(user, 1, keyboard.id, '1', '1');
    await user.click(screen.getByRole('button', { name: 'Create purchase invoice' }));

    await screen.findByRole('status');
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
      date: '2026-09-01',
    });
  });

  it('shows server validation errors and keeps the input for correction', async () => {
    mockFetch(async () =>
      jsonResponse(400, { statusCode: 400, message: ['date must not be in the future (today is 2026-09-25)'] }),
    );
    const user = renderForm();

    await user.type(screen.getByLabelText('Supplier'), 'Gulf Tech');
    await fillLine(user, 1, keyboard.id, '10', '45');
    await user.click(screen.getByRole('button', { name: 'Create purchase invoice' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('date must not be in the future');
    expect(screen.getByLabelText('Supplier')).toHaveValue('Gulf Tech');
    expect(screen.getByLabelText('Quantity for line 1')).toHaveValue(10);
  });

  it('disables the form while submitting (no double invoices)', async () => {
    let respond: (response: Response) => void = () => {};
    mockFetch(() => new Promise<Response>((resolve) => (respond = resolve)));
    const user = renderForm();

    await user.type(screen.getByLabelText('Supplier'), 'Gulf Tech');
    await fillLine(user, 1, keyboard.id, '1', '1');
    await user.click(screen.getByRole('button', { name: 'Create purchase invoice' }));

    expect(screen.getByRole('button', { name: 'Creating invoice…' })).toBeDisabled();
    expect(screen.getByLabelText('Supplier')).toBeDisabled();

    respond(jsonResponse(201, createdInvoice()));
    expect(await screen.findByRole('button', { name: 'Create purchase invoice' })).toBeEnabled();
  });
});
