import React from 'react';
import { render } from '@testing-library/react-native';
import ImportPhotoModal from '@/components/ImportPhotoModal';
import { FontProvider } from '@/context/FontContext';

const mockImage = jest.fn();
jest.mock('expo-image', () => ({ Image: (props: unknown) => { mockImage(props); return null; } }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

it("keeps each reviewed photo out of Glide's disk cache", async () => {
  await render(
    <FontProvider>
      <ImportPhotoModal visible photos={[{ uri: 'file:///picked.jpg', suggestedDate: '2026-03-01' }]} onSave={jest.fn()} onCancel={jest.fn()} />
    </FontProvider>,
  );
  expect(mockImage.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ cachePolicy: 'memory' }));
});
