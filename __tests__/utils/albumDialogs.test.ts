import { Alert, type AlertButton } from 'react-native';
import * as Haptics from 'expo-haptics';
import { confirmDeleteAlbum } from '@/utils/albumDialogs';

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

const buttons = () => alertSpy.mock.calls.at(-1)?.[2] as AlertButton[];

it("won't delete the last album, with an error buzz", () => {
  const onDelete = jest.fn();
  confirmDeleteAlbum({ name: 'daily' }, 1, onDelete);
  expect(alertSpy).toHaveBeenCalledWith("Can't delete", 'You need at least one album.');
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
  expect(onDelete).not.toHaveBeenCalled();
});

it('asks without a haptic, names the album, and deletes only on confirm (then one success haptic)', () => {
  const onDelete = jest.fn();
  confirmDeleteAlbum({ name: 'daily' }, 2, onDelete);
  // The press that opened this already tapped: asking adds no haptic of its own.
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  expect(alertSpy.mock.calls[0][0]).toBe('Delete album?');
  expect(alertSpy.mock.calls[0][1]).toContain('"daily"');
  expect(onDelete).not.toHaveBeenCalled();

  buttons().find((b) => b.style === 'destructive')!.onPress!();
  expect(onDelete).toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenLastCalledWith('success');
});
