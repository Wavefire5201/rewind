import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import type { ConfirmOptions } from '@/utils/confirm';
import DayRoute from '@/app/album/day';
import { FontProvider } from '@/context/FontContext';
import { dayRange } from '@/utils/days';
import { takeLastViewedDay } from '@/utils/lastViewedDay';
import type { DayPageProps } from '@/components/day/DayPage';
import type { PhotoEntry, WeightEntry } from '@/types';

jest.mock('@/components/day/DayPage', () => () => null);
jest.mock('@/components/ui/AlbumLockGate', () => ({ children }: { children: React.ReactNode }) => children);

let mockParams: { albumId: string; date?: string; focus?: string } = { albumId: 'a' };
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const photo = (date: string, caption = ''): PhotoEntry => ({
  id: `p-${date}`, albumId: 'a', date, imageUri: `file:///document/${date}.jpg`, caption,
  capturedAt: `${date}T14:00:00.000Z`, cameraDirection: 'front',
});
const weight = (date: string): WeightEntry => ({ albumId: 'a', date, value: 80, unit: 'kg', updatedAt: `${date}T08:00:00.000Z` });

let mockPhotos: PhotoEntry[] = [];
const mockAddPhoto = jest.fn();
const mockDeletePhoto = jest.fn();
const mockUpdatePhoto = jest.fn();
const mockSetWeight = jest.fn(async () => true);
const mockDeleteWeight = jest.fn(async () => true);
jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    albums: [{ id: 'a', name: 'daily', createdAt: '2026-03-01T12:00:00.000Z' }],
    photos: mockPhotos,
    weights: [weight('2026-02-27'), { ...weight('2026-01-01'), albumId: 'other' }],
    profile: { joinDate: '2026-01-01' },
    settings: { units: 'metric', use24hClock: false },
    today: '2026-03-06',
    addPhoto: mockAddPhoto,
    deletePhoto: mockDeletePhoto,
    updatePhoto: mockUpdatePhoto,
    setWeight: mockSetWeight,
    deleteWeight: mockDeleteWeight,
  }),
}));

const mockPick = jest.fn(async (_opts?: unknown): Promise<{ uri: string; date: string | null }[]> => [{ uri: 'file:///picked.jpg', date: null }]);
const mockCreateEntry = jest.fn(async (uri: string, date: string, caption: string, albumId: string) => ({
  ...photo(date, caption), id: 'new', imageUri: uri, albumId,
}));
jest.mock('@/utils/import', () => ({
  pickPhotosFromLibrary: (opts: unknown) => mockPick(opts),
  createPhotoEntry: (uri: string, date: string, caption: string, albumId: string) => mockCreateEntry(uri, date, caption, albumId),
}));
const mockConfirm = jest.fn(async (_options: ConfirmOptions) => true);
jest.mock('@/utils/confirm', () => ({ ...jest.requireActual('@/utils/confirm'), confirm: (o: ConfirmOptions) => mockConfirm(o) }));

const pager = () => screen.getByTestId('day-pager');
/** The props the pager gives the page for `date` (only pages near the visible one mount). */
const page = (date: string): DayPageProps => {
  const { data, renderItem } = pager().props as { data: string[]; renderItem: (i: { item: string; index: number }) => React.ReactElement<DayPageProps> };
  return renderItem({ item: date, index: data.indexOf(date) }).props;
};

async function open(params: Partial<typeof mockParams> = {}) {
  mockParams = { albumId: 'a', ...params };
  await render(<FontProvider><DayRoute /></FontProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPhotos = [photo('2026-03-03', 'first'), photo('2026-03-05')];
  takeLastViewedDay('a');
});

it('pages run from the earliest weight to today', async () => {
  await open({ date: '2026-03-05' });
  expect(pager().props.data).toEqual(dayRange('2026-02-27', '2026-03-06'));
});

it('opens on the tapped day', async () => {
  await open({ date: '2026-03-05' });
  expect(pager().props.initialScrollIndex).toBe(6);
});

it('a date outside the range opens the nearest day', async () => {
  await open({ date: '2025-01-01' });
  expect(pager().props.initialScrollIndex).toBe(0);
  await screen.unmount();
  await open({ date: '2027-01-01' });
  expect(pager().props.initialScrollIndex).toBe(7);
  await screen.unmount();
  await open({});
  expect(pager().props.initialScrollIndex).toBe(7);
});

it("gives each page its own day's photo and weight, in the app's unit", async () => {
  await open({ date: '2026-03-05' });
  expect(page('2026-03-03').photo?.id).toBe('p-2026-03-03');
  expect(page('2026-03-04').photo).toBeNull();
  expect(page('2026-02-27').weight?.value).toBe(80);
  expect(page('2026-03-06')).toEqual(expect.objectContaining({ isToday: true, unit: 'kg', dayNumber: 8 }));
});

it('adding from the library puts the photo on that day', async () => {
  await open({ date: '2026-03-04' });
  await act(async () => page('2026-03-04').onAddFromLibrary());
  expect(mockPick).toHaveBeenCalledWith({ multiple: false });
  expect(mockCreateEntry).toHaveBeenCalledWith('file:///picked.jpg', '2026-03-04', '', 'a');
  expect(mockAddPhoto).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-03-04' }));
});

it('replacing a past photo keeps its caption and never touches today', async () => {
  await open({ date: '2026-03-03' });
  await act(async () => page('2026-03-03').onAddFromLibrary());
  expect(mockCreateEntry).toHaveBeenCalledWith('file:///picked.jpg', '2026-03-03', 'first', 'a');
  expect(mockAddPhoto).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-03-03', caption: 'first' }));
});

it('a cancelled pick adds nothing', async () => {
  mockPick.mockResolvedValueOnce([]);
  await open({ date: '2026-03-04' });
  await act(async () => page('2026-03-04').onAddFromLibrary());
  expect(mockAddPhoto).not.toHaveBeenCalled();
});

it("taking today's photo opens the camera for the album", async () => {
  await open();
  await act(async () => page('2026-03-06').onTakePhoto());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/camera', params: { albumId: 'a' } });
});

it('deleting asks first and stays on the day: the range is frozen', async () => {
  await open({ date: '2026-03-03' });
  const before = pager().props.data;
  await act(async () => page('2026-03-03').onDelete());
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'delete photo?', destructive: true }));
  expect(mockDeletePhoto).toHaveBeenCalledWith('p-2026-03-03');
  // The photos change (the earliest one is gone), but the open view keeps its days.
  mockPhotos = [photo('2026-03-05')];
  await screen.rerender(<FontProvider><DayRoute /></FontProvider>);
  expect(pager().props.data).toEqual(before);
});

it('a declined delete keeps the photo', async () => {
  mockConfirm.mockResolvedValueOnce(false);
  await open({ date: '2026-03-03' });
  await act(async () => page('2026-03-03').onDelete());
  expect(mockDeletePhoto).not.toHaveBeenCalled();
});

it('saves a caption and a weight for the day, and an emptied weight deletes it', async () => {
  await open({ date: '2026-03-03' });
  await act(async () => page('2026-03-03').onCaption('hello'));
  expect(mockUpdatePhoto).toHaveBeenCalledWith('p-2026-03-03', { caption: 'hello' });
  await act(async () => page('2026-03-03').onWeight({ value: 79, unit: 'kg' }));
  expect(mockSetWeight).toHaveBeenCalledWith('a', '2026-03-03', { value: 79, unit: 'kg' });
  await act(async () => page('2026-02-27').onWeight(null));
  expect(mockDeleteWeight).toHaveBeenCalledWith('a', '2026-02-27');
});

it('the weight field is ready on the opening page only, with focus=weight', async () => {
  await open({ date: '2026-03-06', focus: 'weight' });
  expect(page('2026-03-06').focusWeight).toBe(true);
  expect(page('2026-03-05').focusWeight).toBeFalsy();
});

it('swiping dismisses the keyboard, so a typed weight saves on blur', async () => {
  await open();
  expect(pager().props.keyboardDismissMode).toBe('on-drag');
  expect(pager().props.pagingEnabled).toBe(true);
});

it('remembers the last day shown for the album', async () => {
  await open({ date: '2026-03-05' });
  expect(takeLastViewedDay('a')).toBe('2026-03-05');
  expect(takeLastViewedDay('a')).toBeNull();
});
