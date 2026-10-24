import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { FontProvider } from '@/context/FontContext';
import ExportProgress from '@/components/timelapse/ExportProgress';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const renderProgress = (onCancel = jest.fn()) =>
  render(<FontProvider><ExportProgress visible label="creating backup..." current={3} total={10} onCancel={onCancel} /></FontProvider>);

it("can't be dismissed while exporting, only cancelled", async () => {
  const onCancel = jest.fn();
  await renderProgress(onCancel);
  await act(async () => fireEvent.press(screen.getByTestId('sheet-backdrop', { includeHiddenElements: true })));
  await act(async () => screen.getByTestId('bottom-sheet-modal').props.onRequestClose());
  expect(onCancel).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'cancel' })));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('shows progress', async () => {
  await renderProgress();
  expect(screen.getByText('creating backup...')).toBeTruthy();
  expect(screen.getByText('3 / 10')).toBeTruthy();
  expect(screen.getByTestId('export-progress-fill').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: '30%' })]));
});
