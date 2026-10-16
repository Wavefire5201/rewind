/**
 * Renders every Pressable as held down when `pressState.pressed` is set before rendering
 * (React Native's own testOnly_pressed), so a test can read a control's pressed style.
 * Use with:
 *   jest.mock('react-native/Libraries/Components/Pressable/Pressable',
 *     () => require('../helpers/pressedPressable').pressablePressedMock());
 */
export const pressState = { pressed: false };

export function pressablePressedMock() {
  const R = require('react');
  const Actual = jest.requireActual('react-native/Libraries/Components/Pressable/Pressable').default;
  const Forced = R.forwardRef((props: object, ref: unknown) =>
    R.createElement(Actual, { ...props, ref, testOnly_pressed: pressState.pressed }),
  );
  return { __esModule: true, default: Forced };
}
