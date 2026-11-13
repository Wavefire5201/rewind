import { render, act, screen } from '@testing-library/react-native';
import AlbumDetailScreen from '@/app/album/[id]';
import { FontProvider } from '@/context/FontContext';
import { setLastViewedDay } from '@/utils/lastViewedDay';
import type { PhotoEntry } from '@/types';

let mockAvailable = true;
const mockCard = jest.fn();
const mockGrid = jest.fn();
const mockMonthHeader = jest.fn();
const mockPush = jest.fn();
const mockWeights = [
  { albumId: 'a', date: '2026-10-01', value: 80, unit: 'kg', updatedAt: '2026-10-01T08:00:00.000Z' },
  { albumId: 'a', date: '2026-10-03', value: 79, unit: 'kg', updatedAt: '2026-10-03T08:00:00.000Z' },
  { albumId: 'b', date: '2026-10-01', value: 30, unit: 'kg', updatedAt: '2026-10-01T08:00:00.000Z' },
];
const onePhoto: PhotoEntry[] = [{ id: 'p1', albumId: 'a', date: '2026-10-01', imageUri: 'file:///1.jpg', caption: '', capturedAt: '', cameraDirection: 'front' }];
let mockPhotos: PhotoEntry[] = onePhoto;

jest.mock('@/utils/faceScan', () => ({ isFaceScanAvailable: () => mockAvailable, needsFaceScan: () => false }));
jest.mock('@/components/timeline/TrendCard', () => (props: unknown) => { mockCard(props); return null; });
jest.mock('@/hooks/usePhotos', () => ({ usePhotos: () => ({ photos: mockPhotos, getPhotosByMonth: () => mockPhotos }) }));
jest.mock('@/hooks/useStreak', () => ({ useStreak: () => ({ currentStreak: 1, consistency: 100 }) }));
jest.mock('@/hooks/useAlbumLock', () => ({ useAlbumLock: () => ({ isAlbumLocked: () => false, unlockAlbum: jest.fn() }) }));
jest.mock('@/hooks/usePhotoEncodeBackfill', () => ({ usePhotoEncodeBackfill: () => ({ encoding: false, done: 0, total: 0, pending: false }) }));
jest.mock('@/hooks/useFaceScanBackfill', () => ({ useFaceScanBackfill: () => ({ scanning: false, done: 0, total: 0 }) }));
const mockThumbs = jest.fn();
jest.mock('@/hooks/useThumbnailBackfill', () => ({ useThumbnailBackfill: (...args: unknown[]) => mockThumbs(...args) }));
jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    profile: { joinDate: '2026-01-01' }, albums: [{ id: 'a', name: 'daily', createdAt: '2026-01-01' }],
    weights: mockWeights, settings: { units: 'imperial' }, today: '2026-10-16',
  }),
}));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useLocalSearchParams: () => ({ id: 'a' }),
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useIsFocused: () => true,
    // Runs on mount, as a screen coming into focus does.
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
    Stack: { Screen: () => null },
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/components/ui/MonthPicker', () => () => null);
jest.mock('@/components/timeline/MonthHeader', () => (props: unknown) => { mockMonthHeader(props); return null; });
jest.mock('@/components/timeline/CalendarStats', () => () => null);
jest.mock('@/components/timeline/CalendarGrid', () => (props: unknown) => { mockGrid(props); return null; });

type CardProps = { face: unknown; weights: unknown[]; unit: string; onLogWeight: (date?: string) => void; onSelectDate: (date: string) => void };
type GridProps = { onDayPress: (date: string) => void; weightDates: ReadonlySet<string> };
const card = () => mockCard.mock.calls.at(-1)?.[0] as CardProps;
const grid = () => mockGrid.mock.calls.at(-1)?.[0] as GridProps;
const dayView = (params: Record<string, string>) => ({ pathname: '/album/day', params: { albumId: 'a', ...params } });

const renderScreen = () => render(<FontProvider><AlbumDetailScreen /></FontProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockAvailable = true;
  mockPhotos = onePhoto;
});

it('shows the face strip when the face scanner is available', async () => {
  await renderScreen();
  expect(card().face).not.toBeNull();
});

it('keeps only the weight half of the card without the face scanner (Expo Go, unbuilt iOS)', async () => {
  mockAvailable = false;
  await renderScreen();
  expect(card().face).toBeNull();
});

it("gives the card this album's weights only, in the app's unit", async () => {
  await renderScreen();
  expect(card().weights).toEqual([mockWeights[0], mockWeights[1]]);
  expect(card().unit).toBe('lb');
});

it('tapping a day opens the day view on it', async () => {
  await renderScreen();
  await act(async () => grid().onDayPress('2026-10-01'));
  expect(mockPush).toHaveBeenCalledWith(dayView({ date: '2026-10-01' }));
});

it("+ log opens today's day with the weight field ready", async () => {
  await renderScreen();
  await act(async () => card().onLogWeight());
  expect(mockPush).toHaveBeenCalledWith(dayView({ date: '2026-10-16', focus: 'weight' }));
});

it('a tap on either chart opens that day', async () => {
  await renderScreen();
  await act(async () => card().onLogWeight('2026-10-03'));
  expect(mockPush).toHaveBeenLastCalledWith(dayView({ date: '2026-10-03' }));
  await act(async () => card().onSelectDate('2026-10-01'));
  expect(mockPush).toHaveBeenLastCalledWith(dayView({ date: '2026-10-01' }));
});

it("marks the album's weight days on the calendar", async () => {
  await renderScreen();
  expect([...grid().weightDates].sort()).toEqual(['2026-10-01', '2026-10-03']);
});

it('an album with no photos still shows its calendar and card', async () => {
  mockPhotos = [];
  await renderScreen();
  expect(mockGrid).toHaveBeenCalled();
  expect(mockCard).toHaveBeenCalled();
  expect(screen.queryByText('no photos yet')).toBeNull();
  expect(screen.getByText('tap a day to add a photo or weight')).toBeTruthy();
});

it('comes back to the month of the last day viewed', async () => {
  setLastViewedDay('a', '2026-08-12');
  await renderScreen();
  expect(mockMonthHeader.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ year: 2026, month: 8 }));
});

it('labels a one-photo album "photo", not "photos"', async () => {
  mockAvailable = false;
  await renderScreen();
  expect(screen.getByText('photo')).toBeTruthy();
  expect(screen.queryByText('photos')).toBeNull();
});

it("makes the album's thumbnails while it's open and the q95 pass is done", async () => {
  mockAvailable = false;
  await renderScreen();
  expect(mockThumbs).toHaveBeenLastCalledWith(mockPhotos, true);
});
