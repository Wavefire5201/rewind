import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import ImportPhotoModal from '@/components/ImportPhotoModal';
import { FontProvider } from '@/context/FontContext';

const mockImage = jest.fn();
jest.mock('expo-image', () => ({ Image: (props: unknown) => { mockImage(props); return null; } }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

it("keeps each reviewed photo out of Glide's disk cache", async () => {
  await render(
    <FontProvider>
      <ImportPhotoModal visible photos={[{ uri: 'file:///picked.jpg', suggestedDate: '2026-03-01' }]} photoDates={new Set()} onSave={jest.fn()} onCancel={jest.fn()} />
    </FontProvider>,
  );
  expect(mockImage.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ cachePolicy: 'memory' }));
});

it('changing the date uses the themed picker', async () => {
  const onSave = jest.fn();
  await render(
    <FontProvider>
      <ImportPhotoModal visible photos={[{ uri: 'file:///picked.jpg', suggestedDate: '2026-10-21' }]} photoDates={new Set(['2026-10-20'])} onSave={onSave} onCancel={jest.fn()} />
    </FontProvider>,
  );
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Change date' })));
  expect(screen.getByLabelText('october 20, 2026').props.accessibilityHint).toBe('has a photo');
  await act(async () => fireEvent.press(screen.getByLabelText('october 3, 2026')));
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'use oct 3' })));
  expect(screen.getByText('oct 3, 2026')).toBeTruthy();
});

it.each([
  ['saving', 'save'],
  ['skipping', 'Skip this photo'],
] as const)('%s the last photo taps once: the import\'s result notice plays the success', async (_what, button) => {
  jest.clearAllMocks();
  await render(
    <FontProvider>
      <ImportPhotoModal visible photos={[{ uri: 'file:///picked.jpg', suggestedDate: '2026-10-21' }]} photoDates={new Set()} onSave={jest.fn()} onCancel={jest.fn()} />
    </FontProvider>,
  );
  await act(async () => fireEvent.press(screen.getByRole('button', { name: button })));
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
