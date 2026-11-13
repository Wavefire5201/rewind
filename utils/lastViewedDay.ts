/**
 * The last day the day view showed, per album, so the album's calendar can open on that month
 * when you come back. Read once: taking it clears it.
 */
const lastViewed = new Map<string, string>();

export function setLastViewedDay(albumId: string, date: string): void {
  lastViewed.set(albumId, date);
}

export function takeLastViewedDay(albumId: string): string | null {
  const date = lastViewed.get(albumId) ?? null;
  lastViewed.delete(albumId);
  return date;
}
