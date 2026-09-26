import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { keyboard, monitor, stockUpdated } from '@/test/fixtures';
import { jsonResponse, mockFetch } from '@/test/mock-fetch';
import { MovementForm } from './MovementForm';

const quantityInput = () => screen.getByLabelText('Quantity');
const submitButton = () => screen.getByRole('button', { name: /Record adjustment|Recording/ });

function renderForm() {
  const user = userEvent.setup();
  render(<MovementForm products={[keyboard, monitor]} />);
  return user;
}

describe('MovementForm', () => {
  it('shows the API error for insufficient stock (409) and keeps the input for correction', async () => {
    mockFetch(async () =>
      jsonResponse(409, { statusCode: 409, message: 'Insufficient stock', error: 'Conflict' }),
    );
    const user = renderForm();

    await user.type(quantityInput(), '999');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient stock');
    expect(quantityInput()).toHaveValue(999);
    expect(submitButton()).toBeEnabled();
  });

  it('joins validation messages (400) into one readable error', async () => {
    mockFetch(async () =>
      jsonResponse(400, {
        statusCode: 400,
        message: ['quantity must not be less than 1', 'note should not be empty'],
      }),
    );
    const user = renderForm();

    await user.type(quantityInput(), '5');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'quantity must not be less than 1. note should not be empty',
    );
  });

  it('shows a friendly message when the API is unreachable', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const user = renderForm();

    await user.type(quantityInput(), '1');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });

  it('disables the form while submitting', async () => {
    let respond: (response: Response) => void = () => {};
    mockFetch(() => new Promise<Response>((resolve) => (respond = resolve)));
    const user = renderForm();

    await user.type(quantityInput(), '2');
    await user.click(submitButton());

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveTextContent('Recording…');
    expect(quantityInput()).toBeDisabled();

    respond(jsonResponse(201, { product: keyboard, movement: stockUpdated(keyboard, 43).movement }));
    expect(await screen.findByRole('button', { name: 'Record adjustment' })).toBeEnabled();
  });

  it('sends the movement and resets quantity and note on success, keeping the product', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse(201, {
        product: { ...monitor, quantity: 13 },
        movement: { ...stockUpdated(monitor, 13, 'IN').movement, quantity: 5 },
      }),
    );
    const user = renderForm();

    await user.selectOptions(screen.getByLabelText('Product'), monitor.id);
    await user.click(screen.getByLabelText('IN (add)'));
    await user.type(quantityInput(), '5');
    await user.type(screen.getByLabelText(/Note/), '  Supplier delivery  ');
    await user.click(submitButton());

    expect(await screen.findByText(/Recorded IN 5 × MN-4K-027\. Stock is now 13\./)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/stock-movements');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      productId: monitor.id,
      type: 'IN',
      quantity: 5,
      note: 'Supplier delivery',
    });
    expect(quantityInput()).toHaveValue(null);
    expect(screen.getByLabelText(/Note/)).toHaveValue('');
    expect(screen.getByLabelText('Product')).toHaveValue(monitor.id);
  });

  it('omits a blank note', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse(201, { product: keyboard, movement: stockUpdated(keyboard, 44).movement }),
    );
    const user = renderForm();

    await user.type(quantityInput(), '1');
    await user.type(screen.getByLabelText(/Note/), '   ');
    await user.click(submitButton());

    await screen.findByText(/Recorded/);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).not.toHaveProperty('note');
  });
});
