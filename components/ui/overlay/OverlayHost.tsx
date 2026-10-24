import React from 'react';
import ConfirmLayer from '@/components/ui/overlay/ConfirmLayer';
import NoticeLayer from '@/components/ui/overlay/NoticeLayer';

/**
 * Notices and confirm sheets. Mount one at the app root and one as the last child inside each
 * full-screen Modal, so they always show above whatever is open.
 */
export default function OverlayHost() {
  return (
    <>
      <NoticeLayer />
      <ConfirmLayer />
    </>
  );
}
