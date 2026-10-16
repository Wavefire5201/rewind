import { renderHook, act } from '@testing-library/react-native';
import { useAppContext } from '@/context/AppContext';
import { usePhotos } from '@/hooks/usePhotos';
import { useGreeting } from '@/hooks/useGreeting';
import { useAlbumLock } from '@/hooks/useAlbumLock';
import { getToday } from '@/utils/dates';
import type { PhotoEntry } from '@/types';

jest.mock('@/context/AppContext', () => ({
  useAppContext: jest.fn(),
}));

const mockUseAppContext = useAppContext as unknown as jest.Mock;

function photo(id: string, date: string, albumId = 'a1'): PhotoEntry {
  return {
    id,
    albumId,
    date,
    imageUri: `file:///${id}.jpg`,
    caption: '',
    capturedAt: `${date}T12:00:00.000Z`,
    cameraDirection: 'front',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePhotos', () => {
  const photos = [
    photo('p3', '2026-03-10', 'a2'),
    photo('p1', '2026-03-08'),
    photo('p2', '2026-03-09'),
  ];

  beforeEach(() => {
    mockUseAppContext.mockReturnValue({
      photos,
      today: getToday(),
      addPhoto: jest.fn(),
      updatePhoto: jest.fn(),
      deletePhoto: jest.fn(),
    });
  });

  it('filters by album and sorts by date', async () => {
    const { result } = await renderHook(() => usePhotos('a1'));
    expect(result.current.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.totalPhotos).toBe(2);
  });

  it("follows the context's day, so today's photo isn't stale after midnight", async () => {
    const ctx = { photos, today: '2026-03-09', addPhoto: jest.fn(), updatePhoto: jest.fn(), deletePhoto: jest.fn() };
    mockUseAppContext.mockImplementation(() => ctx);
    const { result, rerender } = await renderHook(() => usePhotos('a1'));
    expect(result.current.todayPhoto?.id).toBe('p2');
    ctx.today = '2026-03-10';
    await rerender({});
    expect(result.current.todayPhoto).toBeNull();
  });

  it("keeps the context's date order without sorting again", async () => {
    const collate = jest.spyOn(String.prototype, 'localeCompare');
    const sorted = [photo('p1', '2026-03-08'), photo('p2', '2026-03-09'), photo('p3', '2026-03-10', 'a2')];
    mockUseAppContext.mockReturnValue({ photos: sorted, today: '2026-03-09', addPhoto: jest.fn(), updatePhoto: jest.fn(), deletePhoto: jest.fn() });
    const { result } = await renderHook(() => usePhotos('a1'));
    expect(result.current.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(collate).not.toHaveBeenCalled();
    collate.mockRestore();
  });

  it('returns everything without an album filter', async () => {
    const { result } = await renderHook(() => usePhotos());
    expect(result.current.totalPhotos).toBe(3);
  });

  it('finds today, most-recent, by-date, and by-month', async () => {
    const today = getToday();
    mockUseAppContext.mockReturnValue({
      photos: [...photos, photo('pt', today)],
      today,
      addPhoto: jest.fn(),
      updatePhoto: jest.fn(),
      deletePhoto: jest.fn(),
    });
    const { result } = await renderHook(() => usePhotos());
    expect(result.current.todayPhoto?.id).toBe('pt');
    expect(result.current.mostRecentPhoto?.date).toBe(today);
    expect(result.current.getPhotoByDate('2026-03-08')?.id).toBe('p1');
    expect(result.current.getPhotoByDate('1999-01-01')).toBeNull();
    expect(result.current.getPhotoByDate(today)?.id).toBe('pt');
    expect(result.current.getPhotosByMonth(2026, 3)).toHaveLength(3);
    expect(result.current.getPhotosByMonth(2020, 1)).toEqual([]);
  });

  it('passes mutators through', async () => {
    const { result } = await renderHook(() => usePhotos());
    const entry = photo('px', '2026-03-11');
    await act(async () => {
      result.current.addPhoto(entry);
    });
    expect(mockUseAppContext().addPhoto).toHaveBeenCalledWith(entry);
  });
});

describe('useGreeting', () => {
  it('derives day number from join date', async () => {
    mockUseAppContext.mockReturnValue({
      profile: { name: 'Ada', avatarUri: null, joinDate: '2026-03-01' },
    });
    const { result } = await renderHook(() => useGreeting());
    expect(['Good Morning', 'Good Afternoon', 'Good Evening']).toContain(result.current.greeting);
    expect(result.current.dayNumber).toBeGreaterThanOrEqual(1);
  });

  it('defaults to day 1 without a join date', async () => {
    mockUseAppContext.mockReturnValue({ profile: { name: 'Ada', avatarUri: null, joinDate: '' } });
    const { result } = await renderHook(() => useGreeting());
    expect(result.current.dayNumber).toBe(1);
  });
});

describe('useAlbumLock', () => {
  beforeEach(() => {
    mockUseAppContext.mockReturnValue({
      albums: [
        { id: 'locked', isLocked: true },
        { id: 'open', isLocked: false },
      ],
      unlockedAlbumIds: new Set(['locked']),
      unlockAlbum: jest.fn(),
    });
  });

  it('reports unlocked + open albums as unlocked', async () => {
    const { result } = await renderHook(() => useAlbumLock());
    expect(result.current.isAlbumLocked('locked')).toBe(false); // in unlock set
    expect(result.current.isAlbumLocked('open')).toBe(false);
    expect(result.current.isAlbumLocked('missing')).toBe(false);
  });

  it('reports locked albums missing from the unlock set', async () => {
    mockUseAppContext.mockReturnValue({
      albums: [{ id: 'locked', isLocked: true }],
      unlockedAlbumIds: new Set<string>(),
      unlockAlbum: jest.fn(),
    });
    const { result } = await renderHook(() => useAlbumLock());
    expect(result.current.isAlbumLocked('locked')).toBe(true);
  });
});

describe('useStreak', () => {
  it("recomputes the streak and week when the context's day changes", async () => {
    const { useStreak } = require('@/hooks/useStreak') as typeof import('@/hooks/useStreak');
    const photos = [photo('p1', '2026-03-08'), photo('p2', '2026-03-09')];
    const ctx = { photos, profile: { joinDate: '2026-03-01' }, today: '2026-03-09' };
    mockUseAppContext.mockImplementation(() => ctx);
    const { result, rerender } = await renderHook(() => useStreak('a1', '2026-03-01T12:00:00.000Z'));
    expect(result.current.currentStreak).toBe(2);
    ctx.today = '2026-03-11';
    await rerender({});
    // Nothing on the 10th or 11th: the run is over.
    expect(result.current.currentStreak).toBe(0);
    expect(result.current.weekStatus.find((d) => d.date === '2026-03-09')?.status).not.toBe('today-done');
  });
});
