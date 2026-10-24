import React from 'react';
import type { ConfirmOptions } from '@/utils/confirm';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import SettingsList from '@/components/profile/SettingsList';
import { FontProvider } from '@/context/FontContext';
import { getDefaultSettings } from '@/utils/storage';
import { MockDirectory } from '../helpers/fileSystemMock';
import * as Haptics from 'expo-haptics';
import type { Album } from '@/types';

const mockUpdateSettings = jest.fn();

jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);
let mockHasPin = true;
jest.mock('@/utils/pin', () => ({ hasPin: async () => mockHasPin, clearPin: jest.fn() }));
const mockPinModal = jest.fn();
jest.mock('@/components/ui/PinModal', () => (props: unknown) => { mockPinModal(props); return null; });
const pinProps = () => mockPinModal.mock.calls.at(-1)?.[0] as { visible: boolean; onSuccess: () => void };
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

const mockConfirm = jest.fn(async (_options: ConfirmOptions) => false);
jest.mock('@/utils/confirm', () => ({ ...jest.requireActual('@/utils/confirm'), confirm: (options: ConfirmOptions) => mockConfirm(options) }));

const renderList = async ({ onClearData = jest.fn(), albums = [] as Album[] } = {}) => {
  await render(
    <FontProvider>
      <SettingsList
        settings={{ ...getDefaultSettings(), photoQuality: 'medium' }}
        updateSettings={mockUpdateSettings}
        onClearData={onClearData}
        onSeedMock={jest.fn()}
        albums={albums}
        onUnlockAllAlbums={jest.fn()}
      />
    </FontProvider>,
  );
  await act(async () => {}); // hasPin resolves
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue(false);
  mockHasPin = true;
});

it('with no passcode, the row offers to set one, and changes once one is set', async () => {
  mockHasPin = false;
  await renderList();
  expect(screen.queryByRole('button', { name: 'change passcode' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'remove passcode' })).toBeNull();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'set passcode' })));
  expect(pinProps()).toEqual(expect.objectContaining({ visible: true, intent: 'set' }));
  await act(async () => pinProps().onSuccess());
  expect(screen.getByRole('button', { name: 'change passcode' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'remove passcode' })).toBeTruthy();
});

describe('clearing all data', () => {
  const clear = () => act(async () => fireEvent.press(screen.getByText('clear all data')));

  it('asks first, and a no clears nothing', async () => {
    const onClearData = jest.fn();
    await renderList({ onClearData });
    await clear();
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'clear all data?', confirmLabel: 'clear everything', destructive: true }));
    expect(onClearData).not.toHaveBeenCalled();
  });

  it('a yes clears, then one success haptic', async () => {
    mockConfirm.mockResolvedValue(true);
    const onClearData = jest.fn();
    await renderList({ onClearData });
    await clear();
    expect(onClearData).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });
});

it('asks before removing a passcode that unlocks albums', async () => {
  const locked = { id: 'a', name: 'trip', createdAt: '2026-01-01T12:00:00.000Z', reminderEnabled: false, reminderTime: '08:00', isLocked: true } as Album;
  await renderList({ albums: [locked] });
  await act(async () => fireEvent.press(screen.getByText('remove passcode')));
  expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
    title: 'remove passcode?', message: expect.stringContaining('1 album is'), confirmLabel: 'remove and unlock', destructive: true,
  }));
});

it.each(['change passcode', 'remove passcode'])('%s: the passcode screen plays the one success haptic, the list adds none', async (name) => {
  await renderList();
  await act(async () => fireEvent.press(screen.getByRole('button', { name })));
  expect(pinProps().visible).toBe(true);
  jest.mocked(Haptics.notificationAsync).mockClear();
  await act(async () => pinProps().onSuccess());
  expect(pinProps().visible).toBe(false);
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});

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
