import { Alert } from 'react-native';
import type { ConfirmOptions } from '@/utils/confirm';
import * as Haptics from 'expo-haptics';
import { confirmDeleteAlbum } from '@/utils/albumDialogs';

const mockConfirm = jest.fn(async (_options: ConfirmOptions) => false);
jest.mock('@/utils/confirm', () => ({ ...jest.requireActual('@/utils/confirm'), confirm: (options: ConfirmOptions) => mockConfirm(options) }));

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

it("won't delete the last album, with an error buzz", async () => {
  const onDelete = jest.fn();
  await confirmDeleteAlbum({ name: 'daily' }, 1, onDelete);
  expect(alertSpy).toHaveBeenCalledWith("Can't delete", 'You need at least one album.');
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(onDelete).not.toHaveBeenCalled();
});

it('asks before deleting with the album name', async () => {
  mockConfirm.mockResolvedValue(false);
  await confirmDeleteAlbum({ name: 'trip' }, 2, jest.fn());
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
    title: 'delete album?',
    message: expect.stringContaining('"trip"'),
    confirmLabel: 'delete',
    destructive: true,
  }));
});

it('a no deletes nothing, with only the press tap', async () => {
  mockConfirm.mockResolvedValue(false);
  const onDelete = jest.fn();
  await confirmDeleteAlbum({ name: 'trip' }, 2, onDelete);
  expect(onDelete).not.toHaveBeenCalled();
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

it('a yes deletes once, then one success haptic', async () => {
  mockConfirm.mockResolvedValue(true);
  const onDelete = jest.fn();
  await confirmDeleteAlbum({ name: 'trip' }, 2, onDelete);
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
});
