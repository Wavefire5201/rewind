import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import AlbumSettingsRoute from '@/app/album/settings';
import { FontProvider } from '@/context/FontContext';
import type { Album, PhotoEntry } from '@/types';

const mockUpdateAlbum = jest.fn();
const mockDeleteAlbum = jest.fn();
const mockAddPhotos = jest.fn((entries: PhotoEntry[]) => ({ added: entries.length, skipped: 0 }));
const mockUpdateProfile = jest.fn();
const mockImportFromBackup = jest.fn();
type ImportSaveEntry = { uri: string; date: string; caption: string };
let mockImportModal: { onSave: (entries: ImportSaveEntry[]) => Promise<void> } | null = null;
let mockImportSheet: { onSelect: (source: 'camera-roll' | 'backup') => Promise<void> } | null = null;
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
    addPhotos: mockAddPhotos, updateProfile: mockUpdateProfile, updateAlbum: mockUpdateAlbum, deleteAlbum: mockDeleteAlbum,
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
jest.mock('@/utils/import', () => ({
  importFromBackup: (...args: unknown[]) => mockImportFromBackup(...args),
  createPhotoEntry: async (uri: string, date: string, caption: string, albumId: string) =>
    ({ id: `imported-${date}`, albumId, date, imageUri: uri, caption, capturedAt: `${date}T12:00:00.000Z`, cameraDirection: 'front' }),
}));
jest.mock('@/utils/notifications', () => ({}));
jest.mock('@/components/ui/PinModal', () => () => null);
jest.mock('@/components/ui/TimePicker', () => () => null);
jest.mock('@/components/ui/TextInputModal', () => () => null);
jest.mock('@/components/timelapse/ExportSheet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/timelapse/ExportProgress', () => () => null);
jest.mock('@/components/ImportPhotoModal', () => (props: typeof mockImportModal) => { mockImportModal = props; return null; });
jest.mock('@/components/ui/ImportSheet', () => ({
  __esModule: true,
  default: (props: typeof mockImportSheet) => { mockImportSheet = props; return null; },
}));

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

it('deletes an album through the shared confirmation', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderSettings();
  await act(async () => fireEvent.press(screen.getByLabelText('Delete album')));
  expect(alertSpy.mock.calls.at(-1)?.[0]).toBe('Delete album?');
  alertSpy.mockRestore();
});

// The join date moves back in AppContext's addPhotos, so both import paths get it.
describe('importing older photos', () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  it('hands a camera-roll import to addPhotos and leaves the join date to it', async () => {
    await renderSettings();
    await act(async () => {
      await mockImportModal!.onSave([
        { uri: 'content://b', date: '2025-06-01', caption: '' },
        { uri: 'content://a', date: '2025-03-10', caption: 'first' },
      ]);
    });
    expect(mockAddPhotos).toHaveBeenCalledTimes(1);
    expect(mockAddPhotos.mock.calls[0][0].map((p) => [p.albumId, p.date, p.caption])).toEqual([
      ['a', '2025-06-01', ''],
      ['a', '2025-03-10', 'first'],
    ]);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Import complete', '2 photos added.');
  });

  it('hands a backup restore to addPhotos the same way', async () => {
    const restored = [{ id: 'r1', albumId: 'a', date: '2025-03-10' }] as PhotoEntry[];
    mockImportFromBackup.mockResolvedValue({ photos: restored, skipped: 0 });
    await renderSettings();
    await act(async () => {
      await mockImportSheet!.onSelect('backup');
    });
    expect(mockAddPhotos).toHaveBeenCalledWith(restored);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Import complete', '1 photo restored from backup.');
  });
});
