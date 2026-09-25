import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InventorySnapshot } from '@/lib/inventory';
import { STOCK_UPDATED_EVENT } from '@/lib/constants';
import { keyboard, monitor, mouse, snapshot, stockUpdated } from '@/test/fixtures';
import { MockEventSource } from '@/test/mock-event-source';
import { jsonResponse, mockFetch } from '@/test/mock-fetch';
import { InventoryDashboard } from './InventoryDashboard';

/** Serves the resync endpoints from `server`, and a successful movement POST. */
function mockApi(server: InventorySnapshot = snapshot()) {
  return mockFetch(async (url) => {
    if (url.includes('/products/low-stock')) return jsonResponse(200, server.lowStock);
    if (url.includes('/products')) {
      return jsonResponse(200, { items: server.products, nextCursor: null });
    }
    if (url.includes('/stock-movements')) {
      return jsonResponse(201, {
        product: { ...keyboard, quantity: 42 },
        movement: stockUpdated(keyboard, 42).movement,
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

const row = (name: RegExp) => screen.getByRole('row', { name });
const lowStockPanel = () => screen.getByRole('region', { name: 'Low stock' });

async function renderLiveDashboard(initial = snapshot()) {
  const view = render(<InventoryDashboard initialSnapshot={initial} />);
  const source = MockEventSource.latest();
  await act(async () => source.open()); // open also triggers a resync
  return { ...view, source };
}

describe('InventoryDashboard', () => {
  beforeEach(() => {
    MockEventSource.install();
    mockApi();
  });

  it('opens a single stream to the API and shows the connection state', async () => {
    render(<InventoryDashboard initialSnapshot={snapshot()} />);
    const source = MockEventSource.latest();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(source.url).toBe('http://api.test/events/stock');
    expect(screen.getByText('Connecting')).toBeInTheDocument();

    await act(async () => source.open());
    expect(screen.getByText('Live')).toBeInTheDocument();

    act(() => source.fail());
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();

    await act(async () => source.open());
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('updates and highlights only the matching row on stock.updated', async () => {
    const { source } = await renderLiveDashboard();

    act(() => source.emit(STOCK_UPDATED_EVENT, stockUpdated(keyboard, 40)));

    const updated = row(/Mechanical Keyboard/);
    expect(within(updated).getByText('40')).toBeInTheDocument();
    expect(updated).toHaveAttribute('data-changed', 'true');
    expect(within(row(/Wireless Mouse/)).getByText('120')).toBeInTheDocument();
    expect(row(/Wireless Mouse/)).not.toHaveAttribute('data-changed');
  });

  it('marks low-stock rows and keeps the low-stock panel live', async () => {
    const { source } = await renderLiveDashboard();
    expect(within(row(/4K Monitor/)).getByText('Low')).toBeInTheDocument();
    expect(within(lowStockPanel()).queryByText(keyboard.name)).not.toBeInTheDocument();

    act(() => source.emit(STOCK_UPDATED_EVENT, stockUpdated(keyboard, 3)));
    expect(within(lowStockPanel()).getByText(keyboard.name)).toBeInTheDocument();
    expect(within(row(/Mechanical Keyboard/)).getByText('Low')).toBeInTheDocument();

    act(() => source.emit(STOCK_UPDATED_EVENT, stockUpdated(monitor, 30, 'IN')));
    expect(within(lowStockPanel()).queryByText(monitor.name)).not.toBeInTheDocument();
  });

  it('resyncs from the API when the stream opens, recovering missed updates', async () => {
    mockApi(snapshot([{ ...keyboard, quantity: 7 }, monitor, mouse]));

    await renderLiveDashboard(snapshot());

    expect(within(row(/Mechanical Keyboard/)).getByText('7')).toBeInTheDocument();
  });

  it('keeps an update that arrives while the resync request is still in flight', async () => {
    // The resync snapshot was read before the event's change committed (stale).
    const staleServer = snapshot();
    let releaseSnapshot: () => void = () => {};
    const snapshotReleased = new Promise<void>((resolve) => (releaseSnapshot = resolve));
    mockFetch(async (url) => {
      await snapshotReleased;
      return url.includes('/low-stock')
        ? jsonResponse(200, staleServer.lowStock)
        : jsonResponse(200, { items: staleServer.products, nextCursor: null });
    });
    render(<InventoryDashboard initialSnapshot={snapshot()} />);
    const source = MockEventSource.latest();

    act(() => source.open()); // resync starts, response held back
    act(() => source.emit(STOCK_UPDATED_EVENT, stockUpdated(keyboard, 5)));
    await act(async () => releaseSnapshot());

    expect(within(row(/Mechanical Keyboard/)).getByText('5')).toBeInTheDocument();
  });

  it('retries by itself when the browser gives up on the stream', async () => {
    jest.useFakeTimers();
    try {
      render(<InventoryDashboard initialSnapshot={snapshot()} />);

      act(() => MockEventSource.latest().fail({ gaveUp: true }));
      act(() => jest.runOnlyPendingTimers());

      expect(MockEventSource.instances).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('closes the stream on unmount', async () => {
    const { source, unmount } = await renderLiveDashboard();

    unmount();

    expect(source.closed).toBe(true);
  });

  it('does not update the table from the form response: only the SSE event does', async () => {
    const user = userEvent.setup();
    const { source } = await renderLiveDashboard();

    await user.type(screen.getByLabelText('Quantity'), '3');
    await user.click(screen.getByRole('button', { name: 'Record movement' }));
    expect(await screen.findByText(/Recorded OUT 3/)).toBeInTheDocument();
    expect(within(row(/Mechanical Keyboard/)).getByText('45')).toBeInTheDocument();

    act(() => source.emit(STOCK_UPDATED_EVENT, stockUpdated(keyboard, 42)));
    expect(within(row(/Mechanical Keyboard/)).getByText('42')).toBeInTheDocument();
  });
});
