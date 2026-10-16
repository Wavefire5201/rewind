import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import PillButton from '@/components/ui/PillButton';
import { Pressed } from '@/constants/theme';
import { pressState } from '../helpers/pressedPressable';

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => require('../helpers/pressedPressable').pressablePressedMock());

beforeEach(() => {
  jest.clearAllMocks();
  pressState.pressed = false;
});

const styleOf = () => StyleSheet.flatten(screen.getByRole('button').props.style);

it('taps on press', async () => {
  const onPress = jest.fn();
  await render(<PillButton label="save" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'save' }));
  expect(onPress).toHaveBeenCalled();
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});

it("stays quiet when the action gives its own feedback", async () => {
  await render(<PillButton label="apply" onPress={jest.fn()} haptic={false} />);
  fireEvent.press(screen.getByRole('button', { name: 'apply' }));
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

it('dims by the shared filled-button amount when pressed', async () => {
  pressState.pressed = true;
  await render(<PillButton label="save" onPress={jest.fn()} />);
  expect(styleOf().opacity).toBe(Pressed.filled);
});

it('comes in sizes, the large one for full-width primary actions', async () => {
  await render(<PillButton label="get started" onPress={jest.fn()} size="large" accessibilityLabel="Get started" />);
  expect(screen.getByRole('button', { name: 'Get started' })).toBeTruthy();
  expect(styleOf().paddingVertical).toBe(16);
});
