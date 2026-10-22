import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import AlbumLockGate from '@/components/ui/AlbumLockGate';
import { FontProvider } from '@/context/FontContext';

let mockLocked = true;
const mockUnlockAlbum = jest.fn();
const mockUpdateAlbum = jest.fn();
const mockBack = jest.fn();

jest.mock('@/hooks/useAlbumLock', () => ({
  useAlbumLock: () => ({ isAlbumLocked: () => mockLocked, unlockAlbum: mockUnlockAlbum }),
}));
jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({ albums: [{ id: 'a', name: 'private' }], updateAlbum: mockUpdateAlbum }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
// A stand-in PIN prompt: shows while visible and exposes its callbacks as buttons.
jest.mock('@/components/ui/PinModal', () => {
  const { Pressable: P, Text: T, View } = require('react-native');
  return ({ visible, onSuccess, onCancel }: { visible: boolean; onSuccess: () => void; onCancel: () => void }) =>
    visible ? (
      <View>
        <P onPress={onSuccess}><T>pin ok</T></P>
        <P onPress={onCancel}><T>pin cancel</T></P>
      </View>
    ) : null;
});

function Secret() {
  return <Text>secret photos</Text>;
}

const renderGate = () =>
  render(
    <FontProvider>
      <AlbumLockGate albumId="a">
        <Secret />
      </AlbumLockGate>
    </FontProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockLocked = true;
});

it('renders the screen when the album is not locked', async () => {
  mockLocked = false;
  await renderGate();
  expect(screen.getByText('secret photos')).toBeTruthy();
});

it('shows the lock screen instead of the album while it is locked', async () => {
  await renderGate();
  expect(screen.queryByText('secret photos')).toBeNull();
  expect(screen.getByText('this album is locked')).toBeTruthy();
  expect(screen.getByText('private')).toBeTruthy();
});

it('unlocks the album once the PIN is entered', async () => {
  await renderGate();
  await fireEvent.press(screen.getByLabelText('Unlock album'));
  expect(Haptics.impactAsync).toHaveBeenCalled();
  await fireEvent.press(screen.getByText('pin ok'));
  expect(mockUnlockAlbum).toHaveBeenCalledWith('a');
});

it('leaves when the PIN prompt is cancelled', async () => {
  await renderGate();
  await fireEvent.press(screen.getByLabelText('Unlock album'));
  await fireEvent.press(screen.getByText('pin cancel'));
  expect(mockBack).toHaveBeenCalled();
  expect(mockUnlockAlbum).not.toHaveBeenCalled();
});

it('has a labeled back button', async () => {
  await renderGate();
  expect(screen.getByLabelText('Go back')).toBeTruthy();
});
