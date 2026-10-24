import React, { useState, useSyncExternalStore } from 'react';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import { useOpenSheetCount, useTopLayer } from '@/components/ui/overlay/layers';
import { getPendingConfirm, resolveConfirm, subscribeConfirm, type PendingConfirm } from '@/utils/confirm';

/**
 * Presents the pending confirm when this is the topmost confirm layer and no other bottom sheet
 * is on screen (iOS can't present two sibling Modals; a sheet still animating closed would hide
 * or drop it). Once it's showing a question it keeps it until answered, even if a newer layer
 * mounts on top.
 */
export default function ConfirmLayer({ testID }: { testID?: string }) {
  const isTop = useTopLayer('confirm');
  const pending = useSyncExternalStore(subscribeConfirm, getPendingConfirm);
  const openSheets = useOpenSheetCount();
  const [pinned, setPinned] = useState<PendingConfirm | null>(null);

  if (pinned && pending?.id !== pinned.id) setPinned(null);
  else if (!pinned && pending && isTop && openSheets === 0) setPinned(pending);

  return (
    <ConfirmSheet
      confirm={pinned}
      onResolve={(result) => { if (pinned) resolveConfirm(pinned.id, result); }}
      testID={testID}
    />
  );
}
