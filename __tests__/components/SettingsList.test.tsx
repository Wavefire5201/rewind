import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import SettingsList from '@/components/profile/SettingsList';
import { FontProvider } from '@/context/FontContext';
import { getDefaultSettings } from '@/utils/storage';
import { MockDirectory } from '../helpers/fileSystemMock';

const mockUpdateSettings = jest.fn();

jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);
jest.mock('@/utils/pin', () => ({ hasPin: async () => true, clearPin: jest.fn() }));
jest.mock('@/components/ui/PinModal', () => () => null);
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const renderList = async () => {
  await render(
    <FontProvider>
      <SettingsList
        settings={{ ...getDefaultSettings(), photoQuality: 'medium' }}
        updateSettings={mockUpdateSettings}
        onClearData={jest.fn()}
        onSeedMock={jest.fn()}
        albums={[]}
        onUnlockAllAlbums={jest.fn()}
      />
    </FontProvider>,
  );
  await act(async () => {}); // hasPin resolves
};

beforeEach(() => jest.clearAllMocks());

it('exposes each setting as a labelled button', async () => {
  await renderList();
  for (const name of ['photo quality', '24-hour clock', 'change passcode', 'remove passcode']) {
    expect(screen.getByRole('button', { name })).toBeTruthy();
  }
});

it('shows the photo quality in lowercase, like the rest of the list', async () => {
  await renderList();
  expect(screen.getByText('medium')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'photo quality' })));
  expect(mockUpdateSettings).toHaveBeenCalledWith({ photoQuality: 'high' });
});

it("estimates storage from photos only, not their thumbnails", async () => {
  const list = jest.spyOn(MockDirectory.prototype, 'list').mockReturnValue(
    ['a_q95.jpg', 'a_q95_thumb.jpg', 'b_q95.jpg', 'b_q95_thumb.jpg'].map((name) => ({ name })) as never,
  );
  await renderList();
  // Two photos at medium quality (~2 MB each).
  expect(screen.getByText('~4 MB')).toBeTruthy();
  list.mockRestore();
});
