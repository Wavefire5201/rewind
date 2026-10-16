import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import CapturePreview from '@/components/camera/CapturePreview';
import { FontProvider } from '@/context/FontContext';
import { fileStore, resetFileSystemMock } from '../helpers/fileSystemMock';

jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View };
});

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
