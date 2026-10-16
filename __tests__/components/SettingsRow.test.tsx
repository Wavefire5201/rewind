import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SettingsRow from '@/components/ui/SettingsRow';
import { FontProvider } from '@/context/FontContext';
import { Colors } from '@/constants/theme';

const renderRow = (props: Partial<React.ComponentProps<typeof SettingsRow>> = {}) =>
  render(<FontProvider><SettingsRow label="rename" {...props} /></FontProvider>);

const colorOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).color;

it('is a labelled button when it does something', async () => {
  const onPress = jest.fn();
  await renderRow({ onPress, accessibilityLabel: 'Rename album' });
  fireEvent.press(screen.getByRole('button', { name: 'Rename album' }));
  expect(onPress).toHaveBeenCalled();
});

it('uses its label for accessibility when no other is given', async () => {
  await renderRow({ onPress: jest.fn() });
  expect(screen.getByRole('button', { name: 'rename' })).toBeTruthy();
});

it('is plain text, not a button, without an action', async () => {
  await renderRow({ label: 'storage', value: '12 MB' });
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText('12 MB')).toBeTruthy();
});

it('keeps a long value on one line so it never pushes the label', async () => {
  const long = 'a very long album name that goes on and on and on and on';
  await renderRow({ value: long, chevron: true, onPress: jest.fn() });
  expect(screen.getByText(long).props.numberOfLines).toBe(1);
});

it('shows values in one colour, and "on" states highlighted', async () => {
  await render(
    <FontProvider>
      <SettingsRow label="quality" value="medium" />
      <SettingsRow label="lock album" value="on" highlight />
    </FontProvider>,
  );
  expect(colorOf('medium')).toBe(Colors.textSecondary);
  expect(colorOf('on')).toBe(Colors.streak);
});

it('colours destructive rows', async () => {
  await renderRow({ label: 'delete album', danger: true, onPress: jest.fn() });
  expect(colorOf('delete album')).toBe(Colors.danger);
});
