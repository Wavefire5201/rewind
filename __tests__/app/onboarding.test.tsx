import { render, screen, fireEvent, act } from '@testing-library/react-native';
import OnboardingScreen from '@/app/onboarding';
import { FontProvider } from '@/context/FontContext';

jest.mock('@/context/AppContext', () => ({ useAppContext: () => ({ addAlbum: jest.fn(), updateProfile: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/ui/TimePicker', () => () => null);

it("the album name step keeps continue above the keyboard on Android too (edge-to-edge doesn't resize the window)", async () => {
  await render(<FontProvider><OnboardingScreen /></FontProvider>);
  await act(async () => fireEvent.press(screen.getByLabelText('Get started')));
  // keyboard-controller's KeyboardAvoidingView (a View in its Jest mock): padding on every
  // platform, placed from its own position on screen.
  const step = screen.getByTestId('onboarding-name-step');
  expect(step.props.behavior).toBe('padding');
  expect(step.props.automaticOffset).toBe(true);
  expect(screen.getByLabelText('Continue')).toBeTruthy();
});
