import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import TextInputModal from '@/components/ui/TextInputModal';
import { FontProvider } from '@/context/FontContext';
import { Colors } from '@/constants/theme';

const renderModal = (props: Partial<React.ComponentProps<typeof TextInputModal>> = {}) =>
  render(
    <FontProvider>
      <TextInputModal visible title="rename album" onConfirm={jest.fn()} onCancel={jest.fn()} {...props} />
    </FontProvider>,
  );

it('shows the empty-name error in the danger colour', async () => {
  await renderModal();
  await act(async () => fireEvent.press(screen.getByRole('button', { name: /confirm/i })));
  const error = screen.getByText("name can't be empty");
  expect(StyleSheet.flatten(error.props.style).color).toBe(Colors.danger);
});
