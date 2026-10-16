import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HomeScreen from '@/app/(tabs)/index';
import { FontProvider } from '@/context/FontContext';
import type { Album } from '@/types';

let mockAlbums: Album[] = [];
let mockTotalPhotos = 0;

const album = (id: string, name: string): Album => ({
  id, name, createdAt: '2026-01-01T12:00:00.000Z', reminderEnabled: false, reminderTime: '08:00', isLocked: false,
});

jest.mock('@/hooks/usePhotos', () => ({
  usePhotos: () => ({ todayPhoto: null, mostRecentPhoto: null, totalPhotos: mockTotalPhotos }),
}));
jest.mock('@/hooks/useStreak', () => ({ useStreak: () => ({ currentStreak: 0, weekStatus: [] }) }));
jest.mock('@/hooks/useGreeting', () => ({ useGreeting: () => ({ greeting: 'hi', dayNumber: 1 }) }));
jest.mock('@/hooks/useAlbumLock', () => ({ useAlbumLock: () => ({ isAlbumLocked: () => false, unlockAlbum: jest.fn() }) }));
jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    albums: mockAlbums, photos: [], isLoading: false,
    addAlbum: jest.fn(), updateAlbum: jest.fn(), deleteAlbum: jest.fn(),
  }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: R.forwardRef(({ children, renderRightActions }: { children: React.ReactNode; renderRightActions?: () => React.ReactNode }, _ref: unknown) => (
      <View>{children}{renderRightActions?.()}</View>
    )),
  };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/ui/PhotoImage', () => () => null);
jest.mock('@/components/ui/PinModal', () => () => null);
jest.mock('@/components/ui/TextInputModal', () => () => null);

const renderHome = () => render(<FontProvider><HomeScreen /></FontProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockAlbums = [album('a', 'daily'), album('b', 'second')];
  mockTotalPhotos = 0;
});

it('counts a single photo as "1 photo"', async () => {
  mockTotalPhotos = 1;
  await renderHome();
  expect(screen.getAllByText('1 photo').length).toBeGreaterThan(0);
  expect(screen.queryByText('1 photos')).toBeNull();
});
