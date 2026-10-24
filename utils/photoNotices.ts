import { notify } from '@/utils/notify';

/**
 * Says why a photo can't be saved while the stored photos are unreadable. Sticky: saving stays
 * blocked for the session. Keyed, so repeated refusals show one notice.
 */
export function notifyCantSavePhotos(): void {
  notify({
    title: "can't save photos",
    message: "rewind couldn't read your saved photos, so it can't save new ones without overwriting them. try restarting the app.",
    tone: 'error',
    sticky: true,
    key: 'cant-save-photos',
  });
}
