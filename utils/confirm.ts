/**
 * Yes/no questions before an action (the app's replacement for system confirm alerts). A
 * module-level FIFO, so any code can await an answer; the confirm layers render the question at
 * the front as a bottom sheet. Dismissing it in any way answers no.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  /** Defaults to 'cancel'. */
  cancelLabel?: string;
  /** A red primary button, for actions that delete or replace something. */
  destructive?: boolean;
}
export interface PendingConfirm extends ConfirmOptions { id: string }

type Entry = PendingConfirm & { resolve: (result: boolean) => void };

let queue: readonly Entry[] = [];
const listeners = new Set<() => void>();
let nextId = 0;

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Asks a question; resolves true for the primary button, false for any way of saying no. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { ...options, cancelLabel: options.cancelLabel ?? 'cancel', id: `confirm-${++nextId}`, resolve }];
    emit();
  });
}

/** The question being asked now (the front of the queue). The same object until it's answered. */
export function getPendingConfirm(): PendingConfirm | null {
  return queue[0] ?? null;
}

/** Answers the question showing now; answers for anything else are ignored. */
export function resolveConfirm(id: string, result: boolean): void {
  const head = queue[0];
  if (!head || head.id !== id) return;
  queue = queue.slice(1);
  emit();
  head.resolve(result);
}

export function subscribeConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetConfirmForTests(): void {
  queue = [];
  listeners.clear();
}
