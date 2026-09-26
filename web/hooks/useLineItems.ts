'use client';

import { useReducer } from 'react';

export type Keyed<T> = T & { key: number };

interface LineState<T> {
  lines: Keyed<T>[];
  /** Next unique key; kept in state so the reducer stays pure (no refs read during render). */
  nextKey: number;
}

type LineAction<T> =
  | { type: 'add' }
  | { type: 'remove'; key: number }
  | { type: 'update'; key: number; patch: Partial<T> }
  | { type: 'reset' };

/**
 * Editable invoice lines. Each line gets a stable key (not its index), so
 * removing a line never shifts React state or focus onto its neighbour.
 */
export function useLineItems<T extends object>(createEmpty: () => T, maxLines: number) {
  const [{ lines }, dispatch] = useReducer(
    (state: LineState<T>, action: LineAction<T>): LineState<T> => {
      switch (action.type) {
        case 'add':
          return state.lines.length >= maxLines
            ? state
            : {
                lines: [...state.lines, { ...createEmpty(), key: state.nextKey }],
                nextKey: state.nextKey + 1,
              };
        case 'remove':
          // Always keep at least one line to fill in.
          return state.lines.length === 1
            ? state
            : { ...state, lines: state.lines.filter((line) => line.key !== action.key) };
        case 'update':
          return {
            ...state,
            lines: state.lines.map((line) =>
              line.key === action.key ? { ...line, ...action.patch } : line,
            ),
          };
        case 'reset':
          return { lines: [{ ...createEmpty(), key: state.nextKey }], nextKey: state.nextKey + 1 };
      }
    },
    undefined,
    (): LineState<T> => ({ lines: [{ ...createEmpty(), key: 0 }], nextKey: 1 }),
  );

  return {
    lines,
    add: () => dispatch({ type: 'add' }),
    remove: (key: number) => dispatch({ type: 'remove', key }),
    update: (key: number, patch: Partial<T>) => dispatch({ type: 'update', key, patch }),
    reset: () => dispatch({ type: 'reset' }),
    canAdd: lines.length < maxLines,
  };
}
