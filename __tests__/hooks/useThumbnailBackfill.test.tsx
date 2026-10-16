import { renderHook, waitFor } from '@testing-library/react-native';
import { useThumbnailBackfill } from '@/hooks/useThumbnailBackfill';
import { makeThumbnail } from '@/utils/photoEncode';
import type { PhotoEntry } from '@/types';
import { fileStore, deletedUris, resetFileSystemMock } from '../helpers/fileSystemMock';

const mockUpdatePhotos = jest.fn();
jest.mock('@/context/AppContext', () => ({ useAppContext: () => ({ updatePhotos: mockUpdatePhotos }) }));
jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@/utils/photoEncode', () => ({
  ...jest.requireActual('@/utils/photoEncode'),
  makeThumbnail: jest.fn(),
}));

const thumb = jest.mocked(makeThumbnail);

function makePhoto(i: number, extra: Partial<PhotoEntry> = {}): PhotoEntry {
  const date = `2026-01-${String(i + 1).padStart(2, '0')}`;
  return {
    id: `p${i}`, albumId: 'a', date, imageUri: `file:///document/${date}_q95.jpg`, caption: '', capturedAt: '',
    cameraDirection: 'front', encoding: 'q95', ...extra,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  resetFileSystemMock();
  mockUpdatePhotos.mockResolvedValue(true);
  thumb.mockImplementation(async (_src, name) => {
    const uri = `file:///document/${name}`;
    fileStore.set(uri, 'dGg=');
    return uri;
  });
});

it('makes thumbnails for stored photos that lack one, and saves them together', async () => {
  const photos = [
    makePhoto(0),
    makePhoto(1),
    makePhoto(2, { thumbUri: 'file:///document/old_thumb.jpg' }), // has one
    makePhoto(3, { encoding: undefined, imageUri: 'file:///document/raw.jpg' }), // not q95 yet
    makePhoto(4, { imageUri: 'https://remote/x.jpg' }), // remote
  ];
  await renderHook(() => useThumbnailBackfill(photos, true));
  await waitFor(() => expect(mockUpdatePhotos).toHaveBeenCalledTimes(1));
  expect(thumb).toHaveBeenCalledTimes(2);
  expect(mockUpdatePhotos.mock.calls[0][0]).toEqual({
    p0: { thumbUri: 'file:///document/2026-01-01_q95_thumb.jpg' },
    p1: { thumbUri: 'file:///document/2026-01-02_q95_thumb.jpg' },
  });
});

it('does nothing while disabled', async () => {
  await renderHook(() => useThumbnailBackfill([makePhoto(0)], false));
  await new Promise((r) => setTimeout(r, 10));
  expect(thumb).not.toHaveBeenCalled();
});

it('deletes the thumbnails it made when the save fails, so none are left unreferenced', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockUpdatePhotos.mockResolvedValue(false);
  await renderHook(() => useThumbnailBackfill([makePhoto(0)], true));
  await waitFor(() => expect(deletedUris).toContain('file:///document/2026-01-01_q95_thumb.jpg'));
});

it("drops the thumbnail of a photo deleted while it was being made", async () => {
  let release!: () => void;
  thumb.mockImplementationOnce((_src, name) => new Promise((resolve) => {
    release = () => {
      const uri = `file:///document/${name}`;
      fileStore.set(uri, 'dGg=');
      resolve(uri);
    };
  }));
  const photos = [makePhoto(0)];
  const { rerender } = await renderHook(({ list }: { list: PhotoEntry[] }) => useThumbnailBackfill(list, true), {
    initialProps: { list: photos },
  });
  await waitFor(() => expect(thumb).toHaveBeenCalled());
  await rerender({ list: [] });
  release();
  await waitFor(() => expect(deletedUris).toContain('file:///document/2026-01-01_q95_thumb.jpg'));
  expect(mockUpdatePhotos).not.toHaveBeenCalledWith(expect.objectContaining({ p0: expect.anything() }));
});
