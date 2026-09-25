import { act, renderHook } from '@testing-library/react';
import { useRecentlyChanged } from './useRecentlyChanged';

const DURATION_MS = 1_000;

describe('useRecentlyChanged', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports an id as changed until the duration has passed', () => {
    const { result } = renderHook(() => useRecentlyChanged(DURATION_MS));

    act(() => result.current.markChanged('a'));
    expect(result.current.changedIds.has('a')).toBe(true);

    act(() => jest.advanceTimersByTime(DURATION_MS));
    expect(result.current.changedIds.has('a')).toBe(false);
  });

  it('restarts the timer when the same id changes again', () => {
    const { result } = renderHook(() => useRecentlyChanged(DURATION_MS));

    act(() => result.current.markChanged('a'));
    act(() => jest.advanceTimersByTime(DURATION_MS - 100));
    act(() => result.current.markChanged('a'));
    act(() => jest.advanceTimersByTime(DURATION_MS - 100));

    expect(result.current.changedIds.has('a')).toBe(true);
  });

  it('clears pending timers on unmount', () => {
    const { result, unmount } = renderHook(() => useRecentlyChanged(DURATION_MS));
    act(() => result.current.markChanged('a'));

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
