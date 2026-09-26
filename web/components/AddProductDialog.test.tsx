import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { product } from '@/test/fixtures';
import { jsonResponse, mockFetch } from '@/test/mock-fetch';
import { AddProductDialog } from './AddProductDialog';

async function openDialog() {
  const user = userEvent.setup();
  render(<AddProductDialog />);
  await user.click(screen.getByRole('button', { name: '+ Add product' }));
  return user;
}

describe('AddProductDialog', () => {
  it('creates a product (SKU uppercased, opening stock optional) and closes', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(201, product({ sku: 'NEW-001' })));
    const user = await openDialog();

    expect(screen.getByRole('dialog', { name: 'Add product' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.type(screen.getByLabelText('Name'), 'New Gadget');
    await user.type(screen.getByLabelText('SKU'), 'new-001');
    await user.type(screen.getByLabelText('Price'), '12.50');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByRole('button', { name: '+ Add product' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/products');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'New Gadget',
      sku: 'NEW-001',
      price: 12.5,
    });
  });

  it('sends opening stock when given', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(201, product()));
    const user = await openDialog();

    await user.type(screen.getByLabelText('Name'), 'New Gadget');
    await user.type(screen.getByLabelText('SKU'), 'NEW-002');
    await user.type(screen.getByLabelText('Price'), '5');
    await user.type(screen.getByLabelText(/Opening stock/), '20');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await screen.findByRole('button', { name: '+ Add product' });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({ quantity: 20 });
  });

  it('shows "SKU already exists" and keeps the dialog open for correction', async () => {
    mockFetch(async () =>
      jsonResponse(409, { statusCode: 409, message: 'SKU already exists', error: 'Conflict' }),
    );
    const user = await openDialog();

    await user.type(screen.getByLabelText('Name'), 'Dup');
    await user.type(screen.getByLabelText('SKU'), 'KB-MECH-001');
    await user.type(screen.getByLabelText('Price'), '1');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('SKU already exists');
    expect(screen.getByLabelText('SKU')).toHaveValue('KB-MECH-001');
  });

  it('closes on Cancel and on Escape without saving', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(201, product()));
    const user = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Add product' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
