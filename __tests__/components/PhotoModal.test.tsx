import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import type { ConfirmOptions } from '@/utils/confirm';
import * as Haptics from 'expo-haptics';
import PhotoModal from '@/components/timeline/PhotoModal';
import { FontProvider } from '@/context/FontContext';
import type { PhotoEntry } from '@/types';

jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);
jest.mock('@/components/ui/PhotoImage', () => () => null);
const mockConfirm = jest.fn(async (_options: ConfirmOptions) => false);
jest.mock('@/utils/confirm', () => ({ ...jest.requireActual('@/utils/confirm'), confirm: (options: ConfirmOptions) => mockConfirm(options) }));
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : () => chain()) });
  return {
    GestureDetector: ({ children }: { children: unknown }) => children,
    GestureHandlerRootView: View,
    Gesture: { Pan: chain, Pinch: chain, Tap: chain, Simultaneous: chain, Exclusive: chain, Race: chain },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const photo: PhotoEntry = { id: 'p1', albumId: 'a', date: '2026-03-05', imageUri: 'file:///a.jpg', caption: '', capturedAt: '2026-03-05T12:00:00.000Z', cameraDirection: 'front' };

it('shows the face readout for the photo on screen', async () => {
  await render(
    <FontProvider>
      <PhotoModal visible photos={[photo]} initialIndex={0} joinDate="2026-01-01" onClose={jest.fn()} onDelete={jest.fn()} onUpdateCaption={jest.fn()}
        readout={(p) => (p.id === 'p1' ? 'face 2% fuller than your 30-day average' : null)} />
    </FontProvider>,
  );
  expect(screen.getByText('face 2% fuller than your 30-day average')).toBeTruthy();
});

it('lifts its content with the keyboard, so the caption being edited stays in sight', async () => {
  // The viewer is a Modal: its own Android window, which only keyboard-controller can track.
  const keyboard = jest.requireMock('react-native-keyboard-controller') as { useReanimatedKeyboardAnimation: jest.Mock };
  keyboard.useReanimatedKeyboardAnimation.mockReturnValue({ height: { value: -320 }, progress: { value: 1 } });
  try {
    const ui = (
      <FontProvider>
        <PhotoModal visible photos={[photo]} initialIndex={0} joinDate="2026-01-01" onClose={jest.fn()} onDelete={jest.fn()} onUpdateCaption={jest.fn()} />
      </FontProvider>
    );
    const view = await render(ui);
    await act(async () => view.rerender(ui)); // animated styles land on the next render
    expect(StyleSheet.flatten(screen.getByTestId('photo-viewer-content').props.style).transform).toEqual([{ translateY: -320 }]);
  } finally {
    keyboard.useReanimatedKeyboardAnimation.mockReturnValue({ height: { value: 0 }, progress: { value: 0 } });
  }
});

describe('deleting a photo', () => {
  const renderModal = (onDelete = jest.fn()) => render(
    <FontProvider>
      <PhotoModal visible photos={[photo]} initialIndex={0} joinDate="2026-01-01" onClose={jest.fn()} onDelete={onDelete} onUpdateCaption={jest.fn()} />
    </FontProvider>,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(false);
  });

  it('asks first, and a no keeps the photo with only the press tap', async () => {
    const onDelete = jest.fn();
    await renderModal(onDelete);
    await act(async () => fireEvent.press(screen.getByLabelText('Delete photo')));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'delete photo?', confirmLabel: 'delete', destructive: true }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('a yes deletes it, then one success haptic', async () => {
    mockConfirm.mockResolvedValue(true);
    const onDelete = jest.fn();
    await renderModal(onDelete);
    await act(async () => fireEvent.press(screen.getByLabelText('Delete photo')));
    expect(onDelete).toHaveBeenCalledWith('p1');
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });
});
