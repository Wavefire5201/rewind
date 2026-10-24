import React from 'react';
import type { ConfirmOptions } from '@/utils/confirm';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import CapturePreview from '@/components/camera/CapturePreview';
import { FontProvider } from '@/context/FontContext';
import { fileStore, resetFileSystemMock } from '../helpers/fileSystemMock';

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
      <CapturePreview visible imageUri={SHOT} onSave={onSave} onRetake={jest.fn()} confirmSave={confirmSave} />
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
  expect(onSave).toHaveBeenCalledWith('', savedCopies()[0]);
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
        <CapturePreview visible imageUri={SHOT} onSave={jest.fn()} onRetake={onRetake} confirmSave={async () => true} />
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
