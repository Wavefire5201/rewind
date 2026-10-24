import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Where notices and confirm sheets render. On Android a React Native Modal is its own window, so
 * anything drawn at the app root sits behind an open Modal. Overlay layers mount at the root and
 * inside every Modal; for each kind, only the most recently mounted layer renders, which is
 * always the one on top.
 */

export type LayerKind = 'notice' | 'confirm';

const stacks: Record<LayerKind, number[]> = { notice: [], confirm: [] };
const listeners = new Set<() => void>();
let nextLayerId = 0;
let openSheets = 0;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Registers this component as a layer of `kind`; true while it's the topmost one. */
export function useTopLayer(kind: LayerKind, enabled = true): boolean {
  const [id] = useState(() => ++nextLayerId);
  useEffect(() => {
    if (!enabled) return;
    stacks[kind].push(id);
    emit();
    return () => {
      stacks[kind] = stacks[kind].filter((layer) => layer !== id);
      emit();
    };
  }, [kind, enabled, id]);
  return useSyncExternalStore(subscribe, () => enabled && stacks[kind].at(-1) === id);
}

/** Marks a bottom sheet as on screen (open or animating out); call the returned function when it's gone. */
export function markSheetOpen(): () => void {
  openSheets += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openSheets -= 1;
    emit();
  };
}

/** How many bottom sheets are on screen: a confirm waits for them, as two sibling Modals can't both present on iOS. */
export function useOpenSheetCount(): number {
  return useSyncExternalStore(subscribe, () => openSheets);
}
