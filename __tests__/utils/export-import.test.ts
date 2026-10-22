import JSZip from 'jszip';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { exportToBackup, exportToPhotoAlbum, shareFile } from '@/utils/export';
import { importFromBackup, createPhotoEntry, pickPhotosFromLibrary } from '@/utils/import';
import { getToday } from '@/utils/dates';
import type { PhotoEntry } from '@/types';
import { fileStore, deletedUris, openedHandles, base64Reads, writeLog, resetFileSystemMock, MockFile } from '../helpers/fileSystemMock';

jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getAlbumAsync: jest.fn(async () => null),
  createAssetAsync: jest.fn(async () => ({ id: 'asset-1' })),
  createAlbumAsync: jest.fn(async () => ({ id: 'album-1' })),
  addAssetsToAlbumAsync: jest.fn(async () => {}),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true })),
}));

function makePhoto(overrides: Partial<PhotoEntry> = {}): PhotoEntry {
  return {
    id: `photo-${Math.random().toString(36).slice(2, 8)}`,
    albumId: 'album-1',
    date: '2026-03-09',
    imageUri: 'file:///a.jpg',
    caption: '',
    capturedAt: '2026-03-09T12:00:00.000Z',
    cameraDirection: 'front',
    ...overrides,
  };
}

beforeEach(() => {
  resetFileSystemMock();
  jest.clearAllMocks();
});

describe('exportToBackup', () => {
  it('zips local photos with a manifest and reports honest counts', async () => {
    fileStore.set('file:///a.jpg', 'QUJD');
    fileStore.set('file:///b.jpg', 'REVG');
    const photos = [
      makePhoto({ imageUri: 'file:///a.jpg', date: '2026-03-08' }),
      makePhoto({ imageUri: 'file:///b.jpg', date: '2026-03-09' }),
      makePhoto({ imageUri: 'https://remote/x.jpg', date: '2026-03-10' }),
    ];
    const progress: [number, number][] = [];
    const res = await exportToBackup(photos, 'Daily', (c, t) => progress.push([c, t]), {
      cancelled: false,
    });

    expect(res.exported).toBe(2);
    expect(res.skipped).toBe(1);
    expect(res.filePath).toMatch(/^file:\/\/\/cache\/rewind-export\/rewind-backup-.*\.rewind$/);
    expect(progress[progress.length - 1]).toEqual([3, 3]);

    // The output is a readable zip with manifest + both images
    const zip = await JSZip.loadAsync(fileStore.get(res.filePath)!, { base64: true });
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.album).toBe('Daily');
    expect(manifest.photos).toHaveLength(2);
    expect(await zip.file('images/2026-03-08.jpg')!.async('base64')).toBe('QUJD');
  });

  it('streams the backup to disk one photo at a time, readable by the importer', async () => {
    // Building the archive in memory (base64 + JSZip) needs several times the album's size,
    // which a year of photos can't survive.
    const photo = (seed: number) =>
      Buffer.from(Array.from({ length: 50_000 }, (_, i) => (i * seed + 3) & 0xff)).toString('base64');
    const days = ['2026-03-01', '2026-03-02', '2026-03-03'];
    days.forEach((d, i) => fileStore.set(`file:///${d}.jpg`, photo(i + 7)));
    const res = await exportToBackup(
      days.map((d) => makePhoto({ imageUri: `file:///${d}.jpg`, date: d, caption: d })),
      'Daily',
      () => {},
      { cancelled: false },
    );

    expect(base64Reads).toHaveLength(0);
    const backupWrites = writeLog.filter((w) => w.uri === res.filePath);
    expect(backupWrites.length).toBeGreaterThan(days.length);
    expect(Math.max(...backupWrites.map((w) => w.bytes))).toBeLessThan(60_000);

    // Restore it with the real importer.
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: res.filePath }],
    });
    const { photos } = await importFromBackup('album-2');
    expect(photos.map((p) => [p.date, p.caption])).toEqual(days.map((d) => [d, d]));
    photos.forEach((p, i) => expect(fileStore.get(p.imageUri)).toBe(fileStore.get(`file:///${days[i]}.jpg`)));
  });

  it('throws when there is nothing local to export', async () => {
    await expect(
      exportToBackup([makePhoto({ imageUri: 'https://remote/x.jpg' })], 'Daily', () => {}, {
        cancelled: false,
      })
    ).rejects.toThrow('remote');
  });

  it('aborts on cancellation', async () => {
    fileStore.set('file:///a.jpg', 'QUJD');
    await expect(
      exportToBackup([makePhoto()], 'Daily', () => {}, { cancelled: true })
    ).rejects.toThrow('Cancelled');
  });
});

describe('exportToPhotoAlbum', () => {
  it('creates the Rewind album on first export and reuses it', async () => {
    fileStore.set('file:///a.jpg', 'QUJD');
    const res = await exportToPhotoAlbum([makePhoto()], () => {}, { cancelled: false });
    expect(res).toEqual({ exported: 1, skipped: 0 });
    expect(MediaLibrary.createAlbumAsync).toHaveBeenCalledWith('Rewind', expect.anything(), false);

    (MediaLibrary.getAlbumAsync as jest.Mock).mockResolvedValueOnce({ id: 'album-1' });
    await exportToPhotoAlbum([makePhoto()], () => {}, { cancelled: false });
    expect(MediaLibrary.addAssetsToAlbumAsync).toHaveBeenCalled();
  });

  it('throws on denied permission or cancellation', async () => {
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    await expect(exportToPhotoAlbum([makePhoto()], () => {}, { cancelled: false })).rejects.toThrow(
      'Permission denied'
    );
    await expect(
      exportToPhotoAlbum([makePhoto()], () => {}, { cancelled: true })
    ).rejects.toThrow('Cancelled');
  });
});

describe('shareFile', () => {
  it('shares when available', async () => {
    await shareFile('file:///x.rewind');
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///x.rewind');
  });
});

describe('importFromBackup', () => {
  async function seedBackupZip(manifest: unknown, images: Record<string, string>): Promise<string> {
    const zip = new JSZip();
    if (manifest !== null) zip.file('manifest.json', JSON.stringify(manifest));
    for (const [name, b64] of Object.entries(images)) {
      zip.file(name, b64, { base64: true });
    }
    const b64 = await zip.generateAsync({ type: 'base64' });
    fileStore.set('file:///cache/backup.rewind', b64);
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///cache/backup.rewind' }],
    });
    return 'file:///cache/backup.rewind';
  }

  it('imports entries, falls back for bad dates, counts missing images', async () => {
    await seedBackupZip(
      {
        photos: [
          { id: 'p1', date: '2026-03-01', caption: 'one', imageFile: 'images/a.jpg' },
          { id: 'p2', date: 'not-a-date', caption: '', imageFile: 'images/b.jpg' },
          { id: 'p3', date: '2026-03-03', caption: '', imageFile: 'images/missing.jpg' },
        ],
      },
      { 'images/a.jpg': 'QUJD', 'images/b.jpg': 'REVG' }
    );
    const progress: [number, number][] = [];
    const { photos, skipped, unreadable } = await importFromBackup('album-1', (c, t) => progress.push([c, t]), {
      cancelled: false,
    });
    expect(photos).toHaveLength(2);
    expect(photos[0].date).toBe('2026-03-01');
    expect(photos[0].caption).toBe('one');
    expect(photos[1].date).toBe(getToday());
    expect(photos.every((p) => p.albumId === 'album-1')).toBe(true);
    // The missing image is counted, not dropped, and the bar still reaches the total.
    expect(skipped).toBe(0);
    expect(unreadable).toBe(1);
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it('counts a photo whose write fails and removes what it left behind', async () => {
    await seedBackupZip(
      {
        photos: [
          { id: 'p1', date: '2026-03-01', caption: '', imageFile: 'images/a.jpg' },
          { id: 'p2', date: '2026-03-02', caption: '', imageFile: 'images/b.jpg' },
          { id: 'p3', date: '2026-03-03', caption: '', imageFile: 'images/c.jpg' },
        ],
      },
      { 'images/a.jpg': 'QUJD', 'images/b.jpg': 'REVG', 'images/c.jpg': 'R0hJ' },
    );
    const realWrite = MockFile.prototype.write;
    const write = jest.spyOn(MockFile.prototype, 'write').mockImplementation(function (this: MockFile, ...args) {
      if (this.uri.endsWith('_2026-03-02.jpg')) throw new Error('disk full');
      return realWrite.apply(this, args);
    });
    try {
      const progress: [number, number][] = [];
      const result = await importFromBackup('album-1', (c, t) => progress.push([c, t]));
      expect(result.photos.map((p) => p.date)).toEqual(['2026-03-01', '2026-03-03']);
      expect(result.unreadable).toBe(1);
      expect(result.skipped).toBe(0);
      expect(progress.at(-1)).toEqual([3, 3]);
      expect(deletedUris.some((u) => u.endsWith('_2026-03-02.jpg'))).toBe(true);
    } finally {
      write.mockRestore();
    }
  });

  it('can restore a day whose earlier entry could not be read', async () => {
    await seedBackupZip(
      {
        photos: [
          { id: 'p1', date: '2026-03-01', caption: 'gone', imageFile: 'images/missing.jpg' },
          { id: 'p2', date: '2026-03-01', caption: 'here', imageFile: 'images/a.jpg' },
        ],
      },
      { 'images/a.jpg': 'QUJD' },
    );
    const result = await importFromBackup('album-1');
    expect(result.photos.map((p) => p.caption)).toEqual(['here']);
    expect(result).toMatchObject({ skipped: 0, unreadable: 1 });
  });

  it('streams the backup through a file handle instead of loading it whole', async () => {
    // The old path base64'd the entire backup into one JS string; a year of photos
    // (1.3 GB) cannot survive that. Reads must stay around one photo in size.
    const photo = () => Buffer.from(Array.from({ length: 60_000 }, (_, i) => (i * 31 + 7) & 0xff)).toString('base64');
    const uri = await seedBackupZip(
      {
        photos: [1, 2, 3].map((d) => ({ id: `p${d}`, date: `2026-03-0${d}`, caption: '', imageFile: `images/${d}.jpg` })),
      },
      { 'images/1.jpg': photo(), 'images/2.jpg': photo(), 'images/3.jpg': photo() },
    );
    const backupSize = Buffer.from(fileStore.get(uri)!, 'base64').length;

    const { photos } = await importFromBackup('album-1');

    expect(photos).toHaveLength(3);
    expect(base64Reads).not.toContain(uri);
    const handle = openedHandles.find((h) => h.uri === uri)!;
    expect(Math.max(...handle.reads)).toBeLessThan(backupSize / 2);
    expect(handle.closed).toBe(true);
  });

  it('writes each photo byte-for-byte and removes the picked cache copy', async () => {
    const uri = await seedBackupZip(
      { photos: [{ id: 'p1', date: '2026-03-01', caption: '', imageFile: 'images/a.jpg' }] },
      { 'images/a.jpg': 'QUJD' },
    );
    const { photos: [entry] } = await importFromBackup('album-1');
    expect(fileStore.get(entry.imageUri)).toBe('QUJD');
    expect(deletedUris).toContain(uri);
  });

  it('returns nothing when the picker is cancelled', async () => {
    await expect(importFromBackup()).resolves.toEqual({ photos: [], skipped: 0, unreadable: 0 });
  });

  it('rejects invalid backups', async () => {
    await seedBackupZip(null, { 'images/a.jpg': 'QUJD' });
    await expect(importFromBackup()).rejects.toThrow('no manifest.json');

    await seedBackupZip({ photos: 'nope' }, {});
    await expect(importFromBackup()).rejects.toThrow('manifest.photos');
  });

  it('honors cancellation between entries', async () => {
    await seedBackupZip(
      { photos: [{ id: 'p1', date: '2026-03-01', caption: '', imageFile: 'images/a.jpg' }] },
      { 'images/a.jpg': 'QUJD' }
    );
    await expect(importFromBackup('album-1', undefined, { cancelled: true })).rejects.toThrow(
      'Cancelled'
    );
  });

  // Paths of the photos the import wrote (the picked backup itself lives in the cache).
  const writtenPhotos = () => [...fileStore.keys()].filter((k) => k.includes('rewind_import_'));

  it("skips days the album already has before writing them, and counts them", async () => {
    await seedBackupZip(
      {
        photos: [
          { id: 'p1', date: '2026-03-01', caption: '', imageFile: 'images/a.jpg' },
          { id: 'p2', date: '2026-03-02', caption: '', imageFile: 'images/b.jpg' },
          { id: 'p3', date: '2026-03-02', caption: '', imageFile: 'images/c.jpg' },
        ],
      },
      { 'images/a.jpg': 'QUJD', 'images/b.jpg': 'REVG', 'images/c.jpg': 'R0hJ' },
    );
    const result = await importFromBackup('album-1', undefined, undefined, new Set(['2026-03-01']));
    expect(result.photos.map((p) => p.date)).toEqual(['2026-03-02']);
    // 03-01 is already in the album; the second 03-02 repeats a day in the backup.
    expect(result.skipped).toBe(2);
    expect(writtenPhotos()).toHaveLength(1);
  });

  it('removes the photos it already wrote when cancelled partway', async () => {
    await seedBackupZip(
      {
        photos: [
          { id: 'p1', date: '2026-03-01', caption: '', imageFile: 'images/a.jpg' },
          { id: 'p2', date: '2026-03-02', caption: '', imageFile: 'images/b.jpg' },
        ],
      },
      { 'images/a.jpg': 'QUJD', 'images/b.jpg': 'REVG' },
    );
    const signal = { cancelled: false };
    await expect(
      importFromBackup('album-1', () => { signal.cancelled = true; }, signal),
    ).rejects.toThrow('Cancelled');
    expect(writtenPhotos()).toHaveLength(0);
  });

  it('yields between photos, so a Cancel tap (or a progress render) can get in', async () => {
    await seedBackupZip(
      { photos: [1, 2, 3, 4].map((d) => ({ id: `p${d}`, date: `2026-03-0${d}`, caption: '', imageFile: `images/${d}.jpg` })) },
      { 'images/1.jpg': 'QUJD', 'images/2.jpg': 'REVG', 'images/3.jpg': 'R0hJ', 'images/4.jpg': 'SktM' },
    );
    const signal = { cancelled: false };
    // Arrives like a tap: as a separate task, not from inside the import's own callbacks.
    setTimeout(() => { signal.cancelled = true; }, 0);
    await expect(importFromBackup('album-1', undefined, signal)).rejects.toThrow('Cancelled');
    expect(writtenPhotos().length).toBe(0);
  });

  it('counts malformed manifest entries instead of failing the whole import', async () => {
    await seedBackupZip(
      { photos: [null, 'x', { id: 'p1', date: '2026-03-01', caption: '', imageFile: 'images/a.jpg' }] },
      { 'images/a.jpg': 'QUJD' },
    );
    const progress: [number, number][] = [];
    const { photos, skipped, unreadable } = await importFromBackup('album-1', (c, t) => progress.push([c, t]));
    expect(photos.map((p) => p.date)).toEqual(['2026-03-01']);
    expect(skipped).toBe(0);
    expect(unreadable).toBe(2);
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
  });
});

describe('createPhotoEntry', () => {
  it('copies into Documents and builds an entry', async () => {
    fileStore.set('file:///picker/x.jpg', 'QUJD');
    const entry = await createPhotoEntry('file:///picker/x.jpg', '2026-03-09', 'cap', 'album-9');
    expect(entry.albumId).toBe('album-9');
    expect(entry.date).toBe('2026-03-09');
    expect(entry.caption).toBe('cap');
    expect(entry.imageUri).toMatch(/^file:\/\/\/document\/rewind_import_.*\.jpg$/);
    expect(fileStore.get(entry.imageUri)).toBe('QUJD');
  });

  it('throws when the copy fails', async () => {
    await expect(createPhotoEntry('file:///picker/gone.jpg', '2026-03-09')).rejects.toThrow();
  });
});

describe('pickPhotosFromLibrary', () => {
  it('returns [] when cancelled', async () => {
    await expect(pickPhotosFromLibrary()).resolves.toEqual([]);
  });

  it('parses EXIF dates and leaves the date empty when there is none', async () => {
    // A missing date must stay missing: defaulting to today let a screenshot replace
    // today's photo.
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg', exif: { DateTimeOriginal: '2026:03:09 10:00:00' } },
        { uri: 'file:///b.jpg', exif: null },
        { uri: 'file:///c.jpg', exif: { DateTimeOriginal: '0000:00:00 00:00:00' } },
      ],
    });
    const res = await pickPhotosFromLibrary();
    expect(res).toEqual([
      { uri: 'file:///a.jpg', date: '2026-03-09' },
      { uri: 'file:///b.jpg', date: null },
      { uri: 'file:///c.jpg', date: null },
    ]);
  });

  it('can pick a single photo', async () => {
    await pickPhotosFromLibrary({ multiple: false });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ allowsMultipleSelection: false }),
    );
  });
});
