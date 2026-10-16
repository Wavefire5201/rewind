import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import FaceGuide from '@/components/camera/FaceGuide';

jest.mock('react-native-reanimated', () => require('../helpers/reanimatedMock').reanimatedMock);

it("draws one dot per point of ML Kit's face contour (36), no hidden spares", async () => {
  const contour = { value: [] } as unknown as SharedValue<number[]>;
  await render(<FaceGuide containerWidth={300} containerHeight={400} contourData={contour} />);
  // Each dot runs an animated style on every face update, hidden or not.
  expect(screen.root.children).toHaveLength(36);
});
