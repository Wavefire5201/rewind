import { render, act, screen } from '@testing-library/react-native';
import AlbumDetailScreen from '@/app/album/[id]';
import { getNotices, resetNoticesForTests } from '@/utils/notify';
import { FontProvider } from '@/context/FontContext';
import type { PhotoEntry } from '@/types';

let mockAvailable = true;
const mockCard = jest.fn();
const mockModal = jest.fn();
const mockGrid = jest.fn();
const mockSheet = jest.fn();
const mockAddPhoto = jest.fn();
const mockAddPhotos = jest.fn(() => ({ added: 1, skipped: 0 }));
const mockPick = jest.fn();
const mockCreateEntry = jest.fn(async (uri: string, date: string, caption: string, albumId: string) => ({
  id: 'new', albumId, date, imageUri: uri, caption, capturedAt: '', cameraDirection: 'front',
}));
const photos: PhotoEntry[] = [{ id: 'p1', albumId: 'a', date: '2026-10-01', imageUri: 'file:///1.jpg', caption: '', capturedAt: '', cameraDirection: 'front' }];

jest.mock('@/utils/faceScan', () => ({ isFaceScanAvailable: () => mockAvailable, needsFaceScan: () => false }));
jest.mock('@/components/face/FaceTrendCard', () => (props: unknown) => { mockCard(props); return null; });
jest.mock('@/components/timeline/PhotoModal', () => (props: unknown) => { mockModal(props); return null; });
jest.mock('@/hooks/usePhotos', () => ({ usePhotos: () => ({ photos, getPhotosByMonth: () => photos }) }));
jest.mock('@/hooks/useStreak', () => ({ useStreak: () => ({ currentStreak: 1, consistency: 100 }) }));
jest.mock('@/hooks/useAlbumLock', () => ({ useAlbumLock: () => ({ isAlbumLocked: () => false, unlockAlbum: jest.fn() }) }));
jest.mock('@/hooks/usePhotoEncodeBackfill', () => ({ usePhotoEncodeBackfill: () => ({ encoding: false, done: 0, total: 0, pending: false }) }));
jest.mock('@/hooks/useFaceScanBackfill', () => ({ useFaceScanBackfill: () => ({ scanning: false, done: 0, total: 0 }) }));
const mockThumbs = jest.fn();
jest.mock('@/hooks/useThumbnailBackfill', () => ({ useThumbnailBackfill: (...args: unknown[]) => mockThumbs(...args) }));
jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    profile: { joinDate: '2026-01-01' }, albums: [{ id: 'a', name: 'daily', createdAt: '2026-01-01' }],
    addPhoto: mockAddPhoto, addPhotos: mockAddPhotos, updatePhoto: jest.fn(), deletePhoto: jest.fn(), updateProfile: jest.fn(), updateAlbum: jest.fn(), deleteAlbum: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'a' }), useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useIsFocused: () => true, Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/ui/MonthPicker', () => () => null);
jest.mock('@/components/ui/PinModal', () => () => null);
jest.mock('@/components/ui/ImportSheet', () => ({ __esModule: true, default: (props: unknown) => { mockSheet(props); return null; } }));
jest.mock('@/components/timeline/MonthHeader', () => () => null);
jest.mock('@/components/timeline/CalendarStats', () => () => null);
jest.mock('@/components/timeline/CalendarGrid', () => (props: unknown) => { mockGrid(props); return null; });
jest.mock('@/components/ui/EmptyState', () => () => null);
jest.mock('@/utils/import', () => ({
  pickPhotosFromLibrary: (...args: unknown[]) => mockPick(...args),
  createPhotoEntry: (uri: string, date: string, caption: string, albumId: string) => mockCreateEntry(uri, date, caption, albumId),
}));

const renderScreen = () => render(<FontProvider><AlbumDetailScreen /></FontProvider>);

beforeEach(() => {
  jest.clearAllMocks();
});

it('shows the face card and the photo readout when the face scanner is available', async () => {
  mockAvailable = true;
  await renderScreen();
  expect(mockCard).toHaveBeenCalled();
  expect(typeof (mockModal.mock.calls.at(-1)?.[0] as { readout?: unknown }).readout).toBe('function');
});

it('hides the face card and the readout without the face scanner (Expo Go, unbuilt iOS)', async () => {
  mockAvailable = false;
  await renderScreen();
  expect(mockCard).not.toHaveBeenCalled();
  expect((mockModal.mock.calls.at(-1)?.[0] as { readout?: unknown }).readout).toBeUndefined();
});

it('labels a one-photo album "photo", not "photos"', async () => {
  mockAvailable = false;
  await renderScreen();
  expect(screen.getByText('photo')).toBeTruthy();
  expect(screen.queryByText('photos')).toBeNull();
});

it('imports one photo onto the tapped empty day, whatever its EXIF date, without replacing anything', async () => {
  mockAvailable = false;
  // The picked image's EXIF says 2026-10-01, a day that already has a photo.
  mockPick.mockResolvedValueOnce([{ uri: 'file:///picked.jpg', date: '2026-10-01' }]);
  await renderScreen();
  const grid = mockGrid.mock.calls.at(-1)?.[0] as { onEmptyDayPress: (d: string) => void };
  await act(async () => grid.onEmptyDayPress('2026-09-15'));
  const sheet = mockSheet.mock.calls.at(-1)?.[0] as { onSelect: (s: string) => Promise<void> };
  await act(async () => sheet.onSelect('camera-roll'));

  expect(mockPick).toHaveBeenCalledWith({ multiple: false });
  expect(mockCreateEntry).toHaveBeenCalledWith('file:///picked.jpg', '2026-09-15', '', 'a');
  expect(mockAddPhotos).toHaveBeenCalledWith([expect.objectContaining({ date: '2026-09-15' })]);
  expect(mockAddPhoto).not.toHaveBeenCalled();
});

it('imports onto an empty day are never refused', async () => {
  mockAvailable = false;
  await renderScreen();
  const grid = mockGrid.mock.calls.at(-1)?.[0] as { onEmptyDayPress: (d: string) => void };
  await act(async () => grid.onEmptyDayPress('2026-09-15'));
  expect(getNotices()).toEqual([]);
  expect((mockSheet.mock.calls.at(-1)?.[0] as { visible: boolean }).visible).toBe(true);
});

describe('filling an empty day', () => {
  async function fillDay() {
    mockAvailable = false;
    mockPick.mockResolvedValueOnce([{ uri: 'file:///picked.jpg', date: '2026-10-01' }]);
    await renderScreen();
    const grid = mockGrid.mock.calls.at(-1)?.[0] as { onEmptyDayPress: (d: string) => void };
    await act(async () => grid.onEmptyDayPress('2026-09-15'));
    const sheet = mockSheet.mock.calls.at(-1)?.[0] as { onSelect: (s: string) => Promise<void> };
    await act(async () => sheet.onSelect('camera-roll'));
  }
  beforeEach(() => resetNoticesForTests());
  afterEach(() => resetNoticesForTests());

  it('filling a day that already has a photo says so', async () => {
    mockAddPhotos.mockReturnValueOnce({ added: 0, skipped: 1 });
    await fillDay();
    expect(getNotices()).toEqual([expect.objectContaining({ title: 'that day already has a photo', tone: 'error' })]);
  });

  it("a photo that can't be added says so", async () => {
    mockCreateEntry.mockRejectedValueOnce(new Error('copy failed'));
    await fillDay();
    expect(getNotices()).toEqual([expect.objectContaining({ title: "couldn't add the photo", tone: 'error' })]);
  });

  it('a filled day gets one success haptic and no notice', async () => {
    await fillDay();
    expect(getNotices()).toEqual([]);
  });
});

it("makes the album's thumbnails while it's open and the q95 pass is done", async () => {
  mockAvailable = false;
  await renderScreen();
  expect(mockThumbs).toHaveBeenLastCalledWith(photos, true);
});
