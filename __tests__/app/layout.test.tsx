import React from 'react';
import { render, screen, act } from '@testing-library/react-native';
import RootLayout from '@/app/_layout';
import { frameClocks } from '../helpers/reanimatedMock';
import { notify, resetNoticesForTests } from '@/utils/notify';

jest.mock('expo-font', () => ({ useFonts: () => [true] }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('expo-router', () => ({ Stack: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-gesture-handler', () => require('../helpers/gestureHandlerMock').gestureHandlerMock);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);
let mockProviderThrows = false;
jest.mock('@/context/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => {
    if (mockProviderThrows) throw new Error('storage exploded');
    return children;
  },
  useAppContext: () => ({ isLoading: false }),
}));

beforeEach(() => {
  mockProviderThrows = false;
  frameClocks.length = 0;
});
afterEach(() => resetNoticesForTests());

/** Runs the launch splash to the end: drawn, app ready, faded out. */
async function finishSplash() {
  const clock = frameClocks[frameClocks.length - 1];
  await act(async () => { clock.tick({ timestamp: 10_000 }); });
  await act(async () => { clock.tick({ timestamp: 11_400 }); });
  await act(async () => { clock.tick({ timestamp: 11_700 }); });
}

it('mounts the overlay host only after the splash is done', async () => {
  // A notice raised during launch (e.g. "couldn't load your photos") waits for the splash.
  await render(<RootLayout />);
  await act(async () => { notify({ title: "couldn't load your photos", tone: 'error', sticky: true }); });
  expect(screen.queryByText("couldn't load your photos")).toBeNull();
  await finishSplash();
  expect(screen.getByText("couldn't load your photos")).toBeTruthy();
});

it('shows the error screen, not a blank app, when a provider throws', async () => {
  // A blank app after unlock was seen once: an error above the old boundary (inside the
  // providers) unmounts everything. The boundary now wraps the providers too.
  mockProviderThrows = true;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await render(<RootLayout />);
  expect(screen.getByText('something went wrong')).toBeTruthy();
});

it('covers the app with the drawing R at launch, then gets out of the way', async () => {
  await render(<RootLayout />);
  expect(screen.getByTestId('animated-splash')).toBeTruthy();
  const clock = frameClocks[frameClocks.length - 1];
  await act(async () => { clock.tick({ timestamp: 10_000 }); });
  await act(async () => { clock.tick({ timestamp: 11_400 }); }); // drawn, app ready: fade starts
  await act(async () => { clock.tick({ timestamp: 11_700 }); }); // faded
  expect(screen.queryByTestId('animated-splash')).toBeNull();
});
