'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Tracks ids that changed within the last `durationMs`, e.g. to flash table rows. */
export function useRecentlyChanged(durationMs: number) {
  const [changedIds, setChangedIds] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const markChanged = useCallback(
    (id: string) => {
      // A repeat change restarts the timer instead of ending the highlight early.
      clearTimeout(timers.current.get(id));
      setChangedIds((prev) => new Set(prev).add(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setChangedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, durationMs),
      );
    },
    [durationMs],
  );

  return { changedIds, markChanged };
}
