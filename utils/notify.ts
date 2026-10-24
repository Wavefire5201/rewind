import { AccessibilityInfo } from 'react-native';
import { haptics } from '@/utils/haptics';

/**
 * Notices: short messages that slide in from the top and leave on their own (the app's
 * replacement for informational system alerts). A module-level store, so code outside React
 * (storage callbacks, plain helpers) can raise one; the overlay layers render it.
 */

export type NoticeTone = 'success' | 'error' | 'info';
export interface NoticeAction { label: string; onPress: () => void }
export interface NoticeInput {
  title: string;
  message?: string;
  tone?: NoticeTone;
  /** Stays until swiped away: for messages that must not be missed. */
  sticky?: boolean;
  action?: NoticeAction;
  /** A notice with the same key replaces the visible one instead of stacking. Defaults to its
   *  tone, title and message, so identical notices never stack. */
  key?: string;
}
export interface Notice {
  id: string;
  title: string;
  message?: string;
  tone: NoticeTone;
  sticky: boolean;
  action?: NoticeAction;
  key: string;
  /** When it leaves on its own (ms since epoch); undefined while sticky. */
  expiresAt?: number;
}

/** Errors stay longer: they're the ones people need to read. */
export const NOTICE_DURATION_MS: Record<NoticeTone, number> = { success: 3000, info: 3000, error: 5000 };
export const MAX_NOTICES = 3;

let notices: readonly Notice[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let nextId = 0;
let screenReaderEnabled = false;

function publish(next: readonly Notice[]): void {
  notices = next;
  listeners.forEach((listener) => listener());
}

function clearTimer(id: string): void {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
}

/** Shows a notice, plays its tone's haptic (callers shouldn't play their own), and returns its id. */
export function notify(input: NoticeInput): string {
  const tone = input.tone ?? 'info';
  const key = input.key ?? `${tone}|${input.title}|${input.message ?? ''}`;
  const replaced = notices.find((n) => n.key === key);
  // A screen-reader user needs time to reach the notice (and its button) by swiping.
  const sticky = Boolean(input.sticky || input.action || screenReaderEnabled);
  const notice: Notice = {
    // A replacement keeps the id, so its card stays on screen and just updates.
    id: replaced?.id ?? `notice-${++nextId}`,
    title: input.title,
    message: input.message,
    tone,
    sticky,
    action: input.action,
    key,
    expiresAt: sticky ? undefined : Date.now() + NOTICE_DURATION_MS[tone],
  };

  let next: Notice[];
  if (replaced) {
    clearTimer(replaced.id);
    next = notices.map((n) => (n === replaced ? notice : n));
  } else {
    next = [...notices, notice];
    while (next.length > MAX_NOTICES) {
      // The oldest that would leave anyway goes first; sticky ones are the ones that matter.
      const index = Math.max(0, next.findIndex((n) => !n.sticky));
      clearTimer(next[index].id);
      next.splice(index, 1);
    }
  }
  if (!notice.sticky) timers.set(notice.id, setTimeout(() => dismissNotice(notice.id), NOTICE_DURATION_MS[tone]));
  publish(next);

  if (tone === 'success') haptics.success();
  else if (tone === 'error') haptics.error();
  AccessibilityInfo.announceForAccessibility(input.message ? `${input.title}. ${input.message}` : input.title);
  return notice.id;
}

export function dismissNotice(id: string): void {
  clearTimer(id);
  if (!notices.some((n) => n.id === id)) return;
  publish(notices.filter((n) => n.id !== id));
}

/** Oldest first. The same array until something changes (a useSyncExternalStore snapshot). */
export function getNotices(): readonly Notice[] {
  return notices;
}

export function subscribeNotices(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setScreenReaderEnabled(on: boolean): void {
  screenReaderEnabled = on;
}

export function resetNoticesForTests(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  listeners.clear();
  notices = [];
  screenReaderEnabled = false;
}
