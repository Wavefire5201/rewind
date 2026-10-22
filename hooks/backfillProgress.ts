/** How often a backfill's progress may update: each update re-renders the screen showing it. */
export const PROGRESS_EVERY_MS = 1000;

/**
 * Wraps a progress setter for one backfill run: the first report goes through at once (the
 * screen shows the work has started), later ones at most every PROGRESS_EVERY_MS. A
 * "scanning 120/365" line doesn't need per-photo updates, and a long run re-rendered the
 * screen two or three times a second.
 */
export function throttledProgress<T>(set: (progress: T) => void): (progress: T) => void {
  let lastAt: number | null = null;
  return (progress) => {
    const now = Date.now();
    if (lastAt !== null && now - lastAt < PROGRESS_EVERY_MS) return;
    lastAt = now;
    set(progress);
  };
}
