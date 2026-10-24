import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import { FontProvider } from '@/context/FontContext';
import PinModal from '@/components/ui/PinModal';
import { markSheetOpen } from '@/components/ui/overlay/layers';

jest.mock('@/utils/pin', () => ({
  hasPin: async () => true, savePin: jest.fn(), verifyPin: jest.fn(), getAttemptInfo: async () => ({}),
}));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

it("presents only once no sheet is on screen (iOS can't present two sibling Modals)", async () => {
  // E.g. the "remove and unlock" confirm, still animating out as the passcode screen opens.
  const release = markSheetOpen();
  await render(<FontProvider><PinModal visible intent="unlock" onSuccess={jest.fn()} onCancel={jest.fn()} /></FontProvider>);
  expect(screen.queryByText('enter passcode')).toBeNull();
  await act(async () => release());
  expect(screen.getByText('enter passcode')).toBeTruthy();
});
