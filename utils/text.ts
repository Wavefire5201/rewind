/** The noun for a count: "photo" for 1, "photos" otherwise. */
export function nounFor(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

/** A count with its noun: "1 photo", "3 photos". */
export function plural(count: number, noun: string): string {
  return `${count} ${nounFor(count, noun)}`;
}
