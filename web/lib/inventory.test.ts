import { keyboard, monitor, mouse, product, snapshot, stockUpdated } from '@/test/fixtures';
import { createInventory, inventoryReducer, type InventoryState } from './inventory';

const initial = (): InventoryState => createInventory(snapshot());
const skus = (state: InventoryState) => state.lowStock.map((item) => item.sku);
const quantityOf = (state: InventoryState, id: string) =>
  state.products.find((p) => p.id === id)?.quantity;

describe('inventoryReducer', () => {
  it('updates only the product named in the event', () => {
    const state = inventoryReducer(initial(), {
      type: 'stockUpdated',
      event: stockUpdated(keyboard, 40),
    });

    expect(quantityOf(state, keyboard.id)).toBe(40);
    expect(quantityOf(state, mouse.id)).toBe(mouse.quantity);
  });

  it('adds a product to low stock when it drops below the threshold, most urgent first', () => {
    const state = inventoryReducer(initial(), {
      type: 'stockUpdated',
      event: stockUpdated(keyboard, 2),
    });

    expect(skus(state)).toEqual([keyboard.sku, monitor.sku]); // 2 before 8
  });

  it('removes a product from low stock when it is restocked', () => {
    const state = inventoryReducer(initial(), {
      type: 'stockUpdated',
      event: stockUpdated(monitor, 50, 'IN'),
    });

    expect(skus(state)).toEqual([]);
  });

  it('falls back to the SKU as the name for a product outside the loaded page', () => {
    const unseen = product({ id: 'p-unseen', sku: 'UNSEEN-1', name: 'Hidden' });

    const state = inventoryReducer(initial(), {
      type: 'stockUpdated',
      event: stockUpdated(unseen, 1),
    });

    expect(state.lowStock[0]).toMatchObject({ id: 'p-unseen', name: 'UNSEEN-1', quantity: 1 });
  });

  it('is idempotent: re-applying the same event changes nothing', () => {
    const event = stockUpdated(keyboard, 3);
    const once = inventoryReducer(initial(), { type: 'stockUpdated', event });
    const twice = inventoryReducer(once, { type: 'stockUpdated', event });

    expect(twice).toEqual(once);
  });

  it('resync replaces state with the snapshot, then replays events that arrived meanwhile', () => {
    const stale = inventoryReducer(initial(), {
      type: 'stockUpdated',
      event: stockUpdated(mouse, 99),
    });
    const fresh = snapshot([keyboard, monitor, { ...mouse, quantity: 60 }]);
    const newerThanSnapshot = stockUpdated(keyboard, 1);

    const state = inventoryReducer(stale, {
      type: 'resynced',
      snapshot: fresh,
      replay: [newerThanSnapshot],
    });

    expect(quantityOf(state, mouse.id)).toBe(60); // from the snapshot
    expect(quantityOf(state, keyboard.id)).toBe(1); // replayed, not lost
    expect(skus(state)).toEqual([keyboard.sku, monitor.sku]);
  });
});
