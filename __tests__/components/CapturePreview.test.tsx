import React from 'react';
import type { ConfirmOptions } from '@/utils/confirm';
import { render, screen, fireEvent, act, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import CapturePreview from '@/components/camera/CapturePreview';
import { FontProvider } from '@/context/FontContext';
import { fileStore, resetFileSystemMock } from '../helpers/fileSystemMock';
import { getNotices, resetNoticesForTests } from '@/utils/notify';

jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);
const mockImage = jest.fn();
jest.mock('expo-image', () => ({ Image: (props: unknown) => { mockImage(props); return null; } }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const mockConfirm = jest.fn(async (_options: ConfirmOptions) => false);
jest.mock('@/utils/confirm', () => ({ ...jest.requireActual('@/utils/confirm'), confirm: (options: ConfirmOptions) => mockConfirm(options) }));

const SHOT = 'file:///cache/shot.jpg';
// Photos the preview saved into the documents directory.
const savedCopies = () => [...fileStore.keys()].filter((k) => k.startsWith('file:///document/'));

function renderPreview(confirmSave: () => Promise<boolean>, onSave = jest.fn()) {
  return render(
    <FontProvider>
      <CapturePreview visible imageUri={SHOT} onSave={onSave} onRetake={jest.fn()} weightUnit="lb"
        confirmSave={confirmSave} />
    </FontProvider>,
  );
}

beforeEach(() => {
  resetFileSystemMock();
  fileStore.set(SHOT, 'QUJD');
});

it("doesn't copy the photo when the save isn't confirmed (Replace → Cancel)", async () => {
  const onSave = jest.fn();
  await renderPreview(async () => false, onSave);
  await act(async () => fireEvent.press(screen.getByText('save')));
  expect(onSave).not.toHaveBeenCalled();
  expect(savedCopies()).toHaveLength(0);
});

it('copies the photo into the documents directory and saves it once confirmed', async () => {
  const onSave = jest.fn();
  await renderPreview(async () => true, onSave);
  await act(async () => fireEvent.press(screen.getByText('save')));
  expect(savedCopies()).toHaveLength(1);
  expect(onSave).toHaveBeenCalledWith('', savedCopies()[0], null);
});

it('keeps the caption and its buttons above the keyboard (keyboard-aware scrolling, which works in a Modal)', async () => {
  await renderPreview(async () => true);
  const scroll = screen.getByTestId('capture-preview-scroll');
  expect(within(scroll).getByPlaceholderText('add a caption...')).toBeTruthy();
  expect(within(scroll).getByText('save')).toBeTruthy();
  // Scrolled far enough that the save and retake row clears the keyboard too.
  expect(scroll.props.bottomOffset).toBeGreaterThan(0);
});

it("keeps the full-size preview out of Glide's disk cache", async () => {
  await renderPreview(async () => true);
  expect(mockImage.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ cachePolicy: 'memory' }));
});

describe('retaking with a caption typed', () => {
  async function retakeWithCaption(answer: boolean) {
    mockConfirm.mockResolvedValue(answer);
    const onRetake = jest.fn();
    await render(
      <FontProvider>
        <CapturePreview visible imageUri={SHOT} onSave={jest.fn()} onRetake={onRetake} weightUnit="lb"
        confirmSave={async () => true} />
      </FontProvider>,
    );
    await act(async () => fireEvent.changeText(screen.getByPlaceholderText('add a caption...'), 'first day'));
    await act(async () => fireEvent.press(screen.getByText('retake')));
    return onRetake;
  }

  it('asks before discarding the caption, and a no keeps it', async () => {
    const onRetake = await retakeWithCaption(false);
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'discard caption?', confirmLabel: 'retake', destructive: true }));
    expect(onRetake).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('first day')).toBeTruthy();
  });

  it('a yes retakes', async () => {
    const onRetake = await retakeWithCaption(true);
    expect(onRetake).toHaveBeenCalledTimes(1);
  });
});

it('a save that fails says so and keeps the preview open', async () => {
  resetNoticesForTests();
  fileStore.delete(SHOT); // the shot is gone: the copy fails
  const onSave = jest.fn();
  await renderPreview(async () => true, onSave);
  await act(async () => fireEvent.press(screen.getByText('save')));
  expect(onSave).not.toHaveBeenCalled();
  expect(getNotices()).toEqual([expect.objectContaining({ title: 'save failed', tone: 'error' })]);
  resetNoticesForTests();
});

it('a confirmed save plays one success haptic, not a tap as well', async () => {
  jest.clearAllMocks();
  await renderPreview(async () => true);
  await act(async () => fireEvent.press(screen.getByText('save')));
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
});

describe('the optional weight', () => {
  it('saves with the photo when filled in, in the given unit', async () => {
    const onSave = jest.fn();
    await renderPreview(async () => true, onSave);
    await act(async () => fireEvent.changeText(screen.getByPlaceholderText('weight (optional)'), '172,4'));
    await act(async () => fireEvent.press(screen.getByText('save')));
    expect(onSave).toHaveBeenCalledWith('', savedCopies()[0], { value: 172.4, unit: 'lb' });
  });

  it("doesn't save anything while it isn't a weight, and says what it takes", async () => {
    const onSave = jest.fn();
    await renderPreview(async () => true, onSave);
    await act(async () => fireEvent.changeText(screen.getByPlaceholderText('weight (optional)'), '5000'));
    await act(async () => fireEvent.press(screen.getByText('save')));
    expect(onSave).not.toHaveBeenCalled();
    expect(savedCopies()).toHaveLength(0);
    expect(screen.getByText('enter a weight between 20–500 lb, or leave it blank')).toBeTruthy();
  });

  it("starts from the day's weight when there is one", async () => {
    await render(
      <FontProvider>
        <CapturePreview visible imageUri={SHOT} onSave={jest.fn()} onRetake={jest.fn()} weightUnit="kg" initialWeight="80.5" />
      </FontProvider>,
    );
    expect(screen.getByDisplayValue('80.5')).toBeTruthy();
    expect(screen.getByText('kg')).toBeTruthy();
  });
});

it("starts from the day's caption", async () => {
  await render(
    <FontProvider>
      <CapturePreview visible imageUri={SHOT} onSave={jest.fn()} onRetake={jest.fn()} weightUnit="lb" initialCaption="first" />
    </FontProvider>,
  );
  expect(screen.getByDisplayValue('first')).toBeTruthy();
});

it("retakes without asking when the caption is still the day's own", async () => {
  mockConfirm.mockClear();
  const onRetake = jest.fn();
  await render(
    <FontProvider>
      <CapturePreview visible imageUri={SHOT} onSave={jest.fn()} onRetake={onRetake} weightUnit="lb" initialCaption="first" />
    </FontProvider>,
  );
  await act(async () => fireEvent.press(screen.getByText('retake')));
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(onRetake).toHaveBeenCalledTimes(1);
});
