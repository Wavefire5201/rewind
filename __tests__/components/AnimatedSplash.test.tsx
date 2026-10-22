import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import AnimatedSplash, { SPLASH_DOTS } from '@/components/ui/AnimatedSplash';
import { frameClocks, reanimatedMock } from '../helpers/reanimatedMock';

jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);

const opacity = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).opacity as number;
const dot = (i: number) => opacity(`splash-dot-${i}`);
const today = SPLASH_DOTS - 1;

let onDone: jest.Mock;
const tree = (ready: boolean) => <AnimatedSplash ready={ready} onDone={onDone} />;

/** Advances the splash's frame clock to `ms` after its first frame, then re-renders to read styles. */
async function at(ms: number, ready = true) {
  const clock = frameClocks[frameClocks.length - 1];
  await act(async () => { clock.tick({ timestamp: 10_000 + ms }); });
  await screen.rerender(tree(ready));
}

beforeEach(() => {
  frameClocks.length = 0;
  onDone = jest.fn();
  reanimatedMock.useReducedMotion.mockReturnValue(false);
});

it('draws the R one dot at a time, with today last', async () => {
  await render(tree(true));
  expect(SPLASH_DOTS).toBe(18);
  await at(0);
  expect(dot(0)).toBe(0);

  await at(100); // the first dots are arriving, the later ones haven't started
  expect(dot(0)).toBeGreaterThan(0.9);
  expect(dot(2)).toBeGreaterThan(0);
  expect(dot(10)).toBe(0);

  await at(700); // every day but today is in
  for (let i = 0; i < today; i++) expect(dot(i)).toBe(1);
  expect(dot(today)).toBeLessThan(1);

  await at(1000);
  expect(dot(today)).toBe(1);
  expect(opacity('animated-splash')).toBe(1);
});

it('fades out once the R is drawn and the app is ready, then reports done', async () => {
  await render(tree(true));
  await at(0);
  await at(1100);
  expect(onDone).not.toHaveBeenCalled();
  await at(1200);
  const mid = opacity('animated-splash');
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(1);
  await at(1400);
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('holds the finished R while the app is still loading', async () => {
  await render(tree(false));
  await at(0, false);
  await at(3000, false);
  expect(opacity('animated-splash')).toBe(1);
  expect(onDone).not.toHaveBeenCalled();

  await screen.rerender(tree(true)); // ready now: the fade starts on the next frame
  await at(3100);
  expect(onDone).not.toHaveBeenCalled();
  await at(3400);
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('skips the build-up with Reduce Motion and only fades', async () => {
  reanimatedMock.useReducedMotion.mockReturnValue(true);
  await render(tree(true));
  for (let i = 0; i < SPLASH_DOTS; i++) expect(dot(i)).toBe(1);
  await at(0);
  await at(300);
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('reads as the app name to a screen reader', async () => {
  await render(tree(true));
  expect(screen.getByLabelText('rewind')).toBeTruthy();
});
