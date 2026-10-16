import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AlbumDetailRoute from '@/app/album/[id]';
import AlbumTimelapseRoute from '@/app/album/timelapse';
import CompareRoute from '@/app/album/compare';
import AlbumSettingsRoute from '@/app/album/settings';
import CameraRoute from '@/app/(tabs)/camera';

// Every album route must sit behind the lock gate, or a deep link
// (rewind://album/timelapse?albumId=...) opens a locked album without its PIN.
// The gate is replaced by a marker that never renders the screen, so this only
// checks the wiring; AlbumLockGate.test.tsx covers the gate itself.
let mockParams: Record<string, string> = {};
jest.mock('@/components/ui/AlbumLockGate', () => ({
  __esModule: true,
  default: ({ albumId }: { albumId?: string }) => {
    const { Text: T } = require('react-native');
    return <T>{`gate:${albumId}`}</T>;
  },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({}),
  useNavigation: () => ({}),
  useIsFocused: () => true,
  Stack: { Screen: () => null },
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: jest.fn() }));
jest.mock('expo-media-library', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('react-native-vision-camera', () => ({}));
jest.mock('react-native-vision-camera-face-detector', () => ({}));
jest.mock('@/components/camera/Viewfinder', () => () => null);
jest.mock('@/modules/face-mesh', () => ({}), { virtual: true });
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);
jest.mock('expo-image', () => ({ Image: () => null }));

const routes: [string, React.ComponentType, Record<string, string>][] = [
  ['album/[id]', AlbumDetailRoute, { id: 'a' }],
  ['album/timelapse', AlbumTimelapseRoute, { albumId: 'a' }],
  ['album/compare', CompareRoute, { albumId: 'a' }],
  ['album/settings', AlbumSettingsRoute, { albumId: 'a' }],
  ['(tabs)/camera', CameraRoute, { albumId: 'a' }],
];

it.each(routes)('%s is wrapped in the album lock gate', async (_name, Route, params) => {
  mockParams = params;
  await render(<Route />);
  expect(screen.getByText('gate:a')).toBeTruthy();
});
