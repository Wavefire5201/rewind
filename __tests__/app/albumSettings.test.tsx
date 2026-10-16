import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AlbumSettingsRoute from '@/app/album/settings';
import { FontProvider } from '@/context/FontContext';
import type { Album } from '@/types';

const mockUpdateAlbum = jest.fn();
const mockDeleteAlbum = jest.fn();
const mockDismissAll = jest.fn();
const mockReplace = jest.fn();
let mockHasPin = true;
let mockAlbums: Album[] = [];

const album = (id: string, overrides: Partial<Album> = {}): Album => ({
  id, name: 'daily', createdAt: '2026-01-01T12:00:00.000Z', reminderEnabled: false, reminderTime: '08:00', isLocked: false, ...overrides,
});

jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    profile: { joinDate: '2026-01-01' }, albums: mockAlbums, photos: [], settings: { use24hClock: false },
    addPhotos: jest.fn(), updateProfile: jest.fn(), updateAlbum: mockUpdateAlbum, deleteAlbum: mockDeleteAlbum,
  }),
}));
jest.mock('@/hooks/useAlbumLock', () => ({ useAlbumLock: () => ({ isAlbumLocked: () => false, unlockAlbum: jest.fn() }) }));
jest.mock('@/utils/pin', () => ({ hasPin: async () => mockHasPin }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ albumId: 'a' }),
  useRouter: () => ({ back: jest.fn(), canGoBack: () => true, canDismiss: () => true, dismissAll: mockDismissAll, replace: mockReplace }),
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-reanimated', () => ({
  ...require('../helpers/reanimatedMock').reanimatedMock,
  Easing: { out: (f: unknown) => f, cubic: (t: number) => t },
  withTiming: (v: unknown) => v,
}));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-media-library', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('@/utils/export', () => ({}));
jest.mock('@/utils/import', () => ({}));
jest.mock('@/utils/notifications', () => ({}));
jest.mock('@/components/ui/PinModal', () => () => null);
jest.mock('@/components/ui/TimePicker', () => () => null);
jest.mock('@/components/ui/TextInputModal', () => () => null);
jest.mock('@/components/timelapse/ExportSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/timelapse/ExportProgress', () => () => null);
jest.mock('@/components/ImportPhotoModal', () => () => null);
jest.mock('@/components/ui/ImportSheet', () => ({ __esModule: true, default: () => null }));

const renderSettings = () => render(<FontProvider><AlbumSettingsRoute /></FontProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPin = true;
  mockAlbums = [album('a'), album('b', { name: 'second' })];
});

it('locks the album and returns home when a PIN already exists', async () => {
  await renderSettings();
  await act(async () => fireEvent.press(screen.getByLabelText('Lock album')));
  expect(mockUpdateAlbum).toHaveBeenCalledWith('a', { isLocked: true });
  // The screen is behind the lock gate, so staying would show the unlock prompt.
  expect(mockDismissAll).toHaveBeenCalled();
});

it('keeps a long album name on one line in the rename row', async () => {
  const long = 'my extremely long album name that would wrap across the row';
  mockAlbums = [album('a', { name: long }), album('b')];
  await renderSettings();
  expect(screen.getByText(long).props.numberOfLines).toBe(1);
});
