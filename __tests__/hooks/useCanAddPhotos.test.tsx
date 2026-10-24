import { renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useAppContext } from '@/context/AppContext';
import { useCanAddPhotos } from '@/hooks/useCanAddPhotos';
import { getNotices, resetNoticesForTests } from '@/utils/notify';

jest.mock('@/context/AppContext', () => ({ useAppContext: jest.fn() }));
const mockUseAppContext = useAppContext as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  resetNoticesForTests();
});
afterEach(() => resetNoticesForTests());

it('allows adding photos when they loaded', async () => {
  mockUseAppContext.mockReturnValue({ photosLoadFailed: false });
  const { result } = await renderHook(() => useCanAddPhotos());
  expect(result.current()).toBe(true);
  expect(getNotices()).toEqual([]);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

it('refuses with a sticky error notice', async () => {
  mockUseAppContext.mockReturnValue({ photosLoadFailed: true });
  const { result } = await renderHook(() => useCanAddPhotos());
  expect(result.current()).toBe(false);
  expect(getNotices()).toEqual([expect.objectContaining({
    title: "can't save photos",
    message: expect.stringContaining('without overwriting them'),
    tone: 'error',
    sticky: true,
    key: 'cant-save-photos',
  })]);
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
});
