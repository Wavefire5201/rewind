import React from 'react';
import type { ConfirmOptions } from '@/utils/confirm';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import CameraRoute from '@/app/(tabs)/camera';
import { getNotices, resetNoticesForTests } from '@/utils/notify';
import { FontProvider } from '@/context/FontContext';

const mockViewfinder = jest.fn();
const mockControls = jest.fn();
const mockPreview = jest.fn();
const mockAutoCapture = jest.fn();
const mockTakePhoto = jest.fn(async () => ({ uri: 'file:///cache/shot.jpg' }));
let mockFocused = true;
let mockPhotosLoadFailed = false;

jest.mock('@/components/camera/Viewfinder', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: R.forwardRef((props: unknown, ref: unknown) => {
      mockViewfinder(props);
      R.useImperativeHandle(ref, () => ({ takePhoto: mockTakePhoto, getCurrentLandmarks: () => null }));
      return null;
    }),
  };
});
jest.mock('@/components/camera/CameraControls', () => (props: unknown) => { mockControls(props); return null; });
jest.mock('@/components/camera/CapturePreview', () => (props: unknown) => { mockPreview(props); return null; });
jest.mock('@/hooks/useAutoCapture', () => ({
  useAutoCapture: (args: unknown) => { mockAutoCapture(args); return { progress: 0, isInCooldown: false }; },
}));
jest.mock('@/hooks/useFaceScanBackfill', () => ({ useFaceScanBackfill: () => ({ scanning: false, done: 0, total: 0 }) }));
let mockTodayPhoto: { id: string } | null = null;
jest.mock('@/hooks/usePhotos', () => ({ usePhotos: () => ({ mostRecentPhoto: null, todayPhoto: mockTodayPhoto, addPhoto: jest.fn() }) }));
const mockConfirm = jest.fn(async (_options: ConfirmOptions) => false);
jest.mock('@/utils/confirm', () => ({ ...jest.requireActual('@/utils/confirm'), confirm: (options: ConfirmOptions) => mockConfirm(options) }));
jest.mock('@/hooks/useGreeting', () => ({ useGreeting: () => ({ dayNumber: 1 }) }));
jest.mock('@/hooks/useAlbumLock', () => ({ useAlbumLock: () => ({ isAlbumLocked: () => false, unlockAlbum: jest.fn() }) }));
jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    albums: [{ id: 'a', name: 'daily' }],
    settings: { mirrorSelfies: true, photoQuality: 'medium' },
    updateAlbum: jest.fn(),
    today: '2026-10-16',
    photosLoadFailed: mockPhotosLoadFailed,
  }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ albumId: 'a' }),
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useNavigation: () => ({ canGoBack: () => true }),
  useIsFocused: () => mockFocused,
}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, FlipType: {} }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const last = (fn: jest.Mock) => fn.mock.calls.at(-1)?.[0];
const face = { hasFace: true, faceX: 0.5, faceY: 0.4, faceWidth: 0.3, faceHeight: 0.4, yawAngle: 0, rollAngle: 0 };

async function renderWithFaceInGuide() {
  await render(<FontProvider><CameraRoute /></FontProvider>);
  await act(async () => last(mockViewfinder).onAvailabilityChange(true));
  await act(async () => last(mockViewfinder).onFaceState(face));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockPhotosLoadFailed = false;
  mockTodayPhoto = null;
  mockConfirm.mockResolvedValue(false);
  resetNoticesForTests();
});
afterEach(() => resetNoticesForTests());

it('asks before replacing today\'s photo, and a dismissed question keeps the old one', async () => {
  mockTodayPhoto = { id: 'today' };
  mockConfirm.mockResolvedValue(false);
  await render(<FontProvider><CameraRoute /></FontProvider>);
  await act(async () => last(mockControls).onCapture());
  await expect(last(mockPreview).confirmSave()).resolves.toBe(false);
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'replace photo?', confirmLabel: 'replace', destructive: true }));
});

it('replaces today\'s photo after a yes', async () => {
  mockTodayPhoto = { id: 'today' };
  mockConfirm.mockResolvedValue(true);
  await render(<FontProvider><CameraRoute /></FontProvider>);
  await act(async () => last(mockControls).onCapture());
  await expect(last(mockPreview).confirmSave()).resolves.toBe(true);
});

it("won't save a photo when the stored photos couldn't be read, and says why", async () => {
  mockPhotosLoadFailed = true;
  await render(<FontProvider><CameraRoute /></FontProvider>);
  await act(async () => last(mockControls).onCapture());
  // The preview asks before copying the photo; refusing leaves nothing behind.
  expect(await last(mockPreview).confirmSave()).toBe(false);
  expect(getNotices()).toEqual([expect.objectContaining({ title: "can't save photos", tone: 'error' })]);
});

it('saving framing with no face says why', async () => {
  await render(<FontProvider><CameraRoute /></FontProvider>);
  await act(async () => last(mockControls).onCaptureReference());
  expect(getNotices()).toEqual([expect.objectContaining({ title: 'no face in view', tone: 'error' })]);
});

it('saves normally when the photos loaded', async () => {
  await render(<FontProvider><CameraRoute /></FontProvider>);
  await act(async () => last(mockControls).onCapture());
  expect(await last(mockPreview).confirmSave()).toBe(true);
});

it('opens with the face guide and auto-capture on', async () => {
  await renderWithFaceInGuide();
  expect(screen.getByLabelText('Hide face guide')).toBeTruthy();
  expect(last(mockAutoCapture).enabled).toBe(true);
});

it('stops auto-capture when the face guide is turned off', async () => {
  await renderWithFaceInGuide();
  await act(async () => fireEvent.press(screen.getByLabelText('Hide face guide')));
  expect(screen.getByLabelText('Show face guide')).toBeTruthy();
  expect(last(mockAutoCapture).enabled).toBe(false);
});

it('pauses auto-capture and the camera while the capture preview is open', async () => {
  await renderWithFaceInGuide();
  expect(last(mockAutoCapture).enabled).toBe(true);
  expect(last(mockViewfinder).active).toBe(true);

  await act(async () => last(mockControls).onCapture());
  expect(last(mockPreview).visible).toBe(true);
  expect(last(mockAutoCapture).enabled).toBe(false);
  expect(last(mockViewfinder).active).toBe(false);
});

it('ignores a capture that fires while the preview is open', async () => {
  await renderWithFaceInGuide();
  await act(async () => last(mockControls).onCapture());
  expect(mockTakePhoto).toHaveBeenCalledTimes(1);
  // A tick of auto-capture that was already under way.
  await act(async () => last(mockAutoCapture).onCapture());
  expect(mockTakePhoto).toHaveBeenCalledTimes(1);
});

it('stops the camera when the tab is not in front', async () => {
  mockFocused = false;
  await render(<FontProvider><CameraRoute /></FontProvider>);
  expect(last(mockViewfinder).active).toBe(false);
});
