import React from 'react';
import type { ConfirmOptions } from '@/utils/confirm';
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
const mockDismissAll = jest.fn();
const mockReplace = jest.fn();
let mockHasPin = true;
let mockAlbums: Album[] = [];
let mockPhotosLoadFailed = false;
// Called with ImportSheet's props on every render.
const mockImportSheet = jest.fn();
const mockExportSheet = jest.fn();
const mockExportToBackup = jest.fn();
const mockExportToPhotoAlbum = jest.fn();
let mockPhotos: PhotoEntry[] = [];
const mockConfirm = jest.fn(async (_options: ConfirmOptions) => false);
jest.mock('@/utils/confirm', () => ({ ...jest.requireActual('@/utils/confirm'), confirm: (options: ConfirmOptions) => mockConfirm(options) }));
type ImportSheetProps = { visible: boolean; onSelect: (source: 'camera-roll' | 'backup') => Promise<void> };
const sheetProps = () => mockImportSheet.mock.calls.at(-1)?.[0] as ImportSheetProps;

const album = (id: string, overrides: Partial<Album> = {}): Album => ({
  id, name: 'daily', createdAt: '2026-01-01T12:00:00.000Z', reminderEnabled: false, reminderTime: '08:00', isLocked: false, ...overrides,
});

jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    profile: { joinDate: '2026-01-01' }, albums: mockAlbums, photos: mockPhotos, settings: { use24hClock: false },
    addPhotos: mockAddPhotos, updateProfile: mockUpdateProfile, updateAlbum: mockUpdateAlbum, deleteAlbum: mockDeleteAlbum,
    photosLoadFailed: mockPhotosLoadFailed,
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
jest.mock('@/utils/export', () => ({
  exportToBackup: (...args: unknown[]) => mockExportToBackup(...args),
  exportToPhotoAlbum: (...args: unknown[]) => mockExportToPhotoAlbum(...args),
  shareFile: async () => {},
  cleanupExportDir: async () => {},
}));
jest.mock('@/utils/import', () => ({
  importFromBackup: (...args: unknown[]) => mockImportFromBackup(...args),
  createPhotoEntry: async (uri: string, date: string, caption: string, albumId: string) =>
    ({ id: `imported-${date}`, albumId, date, imageUri: uri, caption, capturedAt: `${date}T12:00:00.000Z`, cameraDirection: 'front' }),
}));
jest.mock('@/utils/notifications', () => ({}));
jest.mock('@/components/ui/PinModal', () => () => null);
jest.mock('@/components/ui/TimePicker', () => () => null);
jest.mock('@/components/ui/TextInputModal', () => () => null);
jest.mock('@/components/timelapse/ExportSheet', () => ({ __esModule: true, default: (props: unknown) => { mockExportSheet(props); return null; } }));
jest.mock('@/components/timelapse/ExportProgress', () => () => null);
jest.mock('@/components/ImportPhotoModal', () => (props: typeof mockImportModal) => { mockImportModal = props; return null; });
jest.mock('@/components/ui/ImportSheet', () => ({ __esModule: true, default: (props: unknown) => { mockImportSheet(props); return null; } }));

const renderSettings = () => render(<FontProvider><AlbumSettingsRoute /></FontProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPin = true;
  mockAlbums = [album('a'), album('b', { name: 'second' })];
  mockPhotosLoadFailed = false;
  mockPhotos = [];
  mockConfirm.mockResolvedValue(false);
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
  await renderSettings();
  await act(async () => fireEvent.press(screen.getByLabelText('Delete album')));
  expect(mockConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'delete album?' }));
});

describe('exporting an album with photos not on this device', () => {
  const photo = (id: string, imageUri: string) =>
    ({ id, albumId: 'a', date: `2026-03-0${id}`, imageUri, caption: '', capturedAt: '2026-03-01T12:00:00.000Z', cameraDirection: 'front' }) as PhotoEntry;
  const exportAs = async (format: 'album' | 'backup') => {
    mockPhotos = [photo('1', 'file:///document/1.jpg'), photo('2', 'https://example.com/2.jpg')];
    await renderSettings();
    await act(async () => { await (mockExportSheet.mock.calls.at(-1)?.[0] as { onSelect: (f: string) => Promise<void> }).onSelect(format); });
  };

  it.each(['album', 'backup'] as const)('asks first before a %s export', async (format) => {
    await exportAs(format);
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'remote photos', message: expect.stringContaining('1 photo'), confirmLabel: 'continue',
    }));
    expect(mockConfirm.mock.calls[0][0].destructive).toBeFalsy();
  });

  it.each(['album', 'backup'] as const)('cancelling the remote-photos question exports nothing (%s)', async (format) => {
    mockConfirm.mockResolvedValue(false);
    await exportAs(format);
    expect(mockExportToPhotoAlbum).not.toHaveBeenCalled();
    expect(mockExportToBackup).not.toHaveBeenCalled();
  });

  it('continuing exports the photos that are on this device', async () => {
    mockConfirm.mockResolvedValue(true);
    mockExportToBackup.mockResolvedValue({ filePath: 'file:///cache/daily.zip', exported: 1, skipped: 1 });
    await exportAs('backup');
    expect(mockExportToBackup).toHaveBeenCalledTimes(1);
  });
});

describe('import photos', () => {
  const sheetVisible = () => sheetProps().visible;

  it('opens the import sheet', async () => {
    await renderSettings();
    await act(async () => fireEvent.press(screen.getByLabelText('Import photos')));
    expect(sheetVisible()).toBe(true);
  });

  it("won't start when the stored photos couldn't be read, and says why", async () => {
    mockPhotosLoadFailed = true;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSettings();
    await act(async () => fireEvent.press(screen.getByLabelText('Import photos')));
    expect(alertSpy).toHaveBeenCalledWith("Can't save photos", expect.any(String));
    expect(sheetVisible()).toBe(false);
    alertSpy.mockRestore();
  });
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
    mockImportFromBackup.mockResolvedValue({ photos: restored, skipped: 0, unreadable: 0 });
    await renderSettings();
    await act(async () => {
      await sheetProps().onSelect('backup');
    });
    expect(mockAddPhotos).toHaveBeenCalledWith(restored);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Import complete', '1 photo restored from backup.');
  });
});

describe('restoring a backup', () => {
  const restored = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, date: `2026-03-0${i + 1}` }));

  async function restore(result: { photos: unknown[]; skipped: number; unreadable: number }) {
    mockImportFromBackup.mockResolvedValueOnce(result);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSettings();
    await act(async () => sheetProps().onSelect('backup'));
    const call = alertSpy.mock.calls.at(-1);
    alertSpy.mockRestore();
    return call?.slice(0, 2);
  }

  it("says how many entries couldn't be read", async () => {
    await expect(restore({ photos: restored(2), skipped: 1, unreadable: 3 })).resolves.toEqual([
      'Import complete',
      "2 photos restored. 1 skipped (already exist). 3 couldn't be read.",
    ]);
  });

  it("reports a backup none of whose entries could be read, instead of calling it empty", async () => {
    await expect(restore({ photos: [], skipped: 0, unreadable: 1 })).resolves.toEqual([
      'Import complete',
      "0 photos restored. 1 couldn't be read.",
    ]);
  });

  it('keeps the short message when every entry was restored', async () => {
    await expect(restore({ photos: restored(1), skipped: 0, unreadable: 0 })).resolves.toEqual([
      'Import complete',
      '1 photo restored from backup.',
    ]);
  });
});
