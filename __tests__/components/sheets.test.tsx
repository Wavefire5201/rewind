import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FontProvider } from '@/context/FontContext';
import ExportSheet from '@/components/timelapse/ExportSheet';
import ImportSheet from '@/components/ui/ImportSheet';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';
import TextInputModal from '@/components/ui/TextInputModal';
import ExportProgress from '@/components/timelapse/ExportProgress';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));

// Every sheet opens, closes and drags the same way: they're all the shared bottom sheet.
it.each([
  ['ExportSheet', <ExportSheet key="e" visible onSelect={jest.fn()} onClose={jest.fn()} />],
  ['ImportSheet', <ImportSheet key="i" visible onSelect={jest.fn()} onClose={jest.fn()} />],
  ['DateRangeSheet', <DateRangeSheet key="d" visible dates={['2026-03-01']} startDate="2026-03-01" endDate="2026-03-01" onApply={jest.fn()} onClose={jest.fn()} />],
  ['TextInputModal', <TextInputModal key="t" visible title="rename album" onConfirm={jest.fn()} onCancel={jest.fn()} />],
  ['ExportProgress', <ExportProgress key="p" visible label="saving to photo album..." current={3} total={10} onCancel={jest.fn()} />],
])('%s is the shared bottom sheet', async (_name, ui) => {
  await render(<FontProvider>{ui}</FontProvider>);
  expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
});
