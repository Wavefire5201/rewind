import { Alert } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '@/context/AppContext';
import { useCanAddPhotos } from '@/hooks/useCanAddPhotos';

jest.mock('@/context/AppContext', () => ({ useAppContext: jest.fn() }));
const mockUseAppContext = useAppContext as unknown as jest.Mock;

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

it('allows adding photos when they loaded', async () => {
  mockUseAppContext.mockReturnValue({ photosLoadFailed: false });
  const { result } = await renderHook(() => useCanAddPhotos());
  expect(result.current()).toBe(true);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

it("refuses, and says why, when the stored photos couldn't be read", async () => {
  mockUseAppContext.mockReturnValue({ photosLoadFailed: true });
  const { result } = await renderHook(() => useCanAddPhotos());
  expect(result.current()).toBe(false);
  expect(alertSpy).toHaveBeenCalledWith("Can't save photos", expect.stringContaining('without overwriting them'));
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
});
