import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { FontProvider } from '@/context/FontContext';
import ExportSheet from '@/components/timelapse/ExportSheet';
import ImportSheet from '@/components/ui/ImportSheet';
import DateRangeSheet from '@/components/timelapse/DateRangeSheet';
import ImportPhotoModal from '@/components/ImportPhotoModal';
import TimerSelector from '@/components/camera/TimerSelector';
import TextInputModal from '@/components/ui/TextInputModal';
import CapturePreview from '@/components/camera/CapturePreview';
import ExportProgress from '@/components/timelapse/ExportProgress';
import FaceTrendCard from '@/components/face/FaceTrendCard';

// The app's own UI copy is lowercase (native system dialogs use sentence case). This
// renders the sheets and modals that had drifted and reads every string they show.
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-file-system', () => require('../helpers/fileSystemMock').expoFileSystemMock);
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

type Node = { children?: (Node | string)[] } | string | null;
function strings(node: Node | Node[]): string[] {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap(strings);
  if (typeof node === 'string') return [node];
  return strings(node.children ?? []);
}

const shown = () => strings(screen.toJSON() as Node).map((s) => s.trim()).filter(Boolean);

it.each([
  ['ExportSheet', <ExportSheet key="e" visible onSelect={jest.fn()} onClose={jest.fn()} />],
  ['ImportSheet', <ImportSheet key="i" visible onSelect={jest.fn()} onClose={jest.fn()} />],
  ['DateRangeSheet', <DateRangeSheet key="d" visible dates={['2026-03-01']} startDate="2026-03-01" endDate="2026-03-01" onApply={jest.fn()} onClose={jest.fn()} />],
  ['ImportPhotoModal', <ImportPhotoModal key="m" visible photos={[{ uri: 'file:///a.jpg', suggestedDate: '2026-03-01' }, { uri: 'file:///b.jpg', suggestedDate: '2026-03-02' }]} onSave={jest.fn()} onCancel={jest.fn()} />],
  ['TimerSelector', <TimerSelector key="t" visible selectedDuration={0} onSelect={jest.fn()} />],
  ['TextInputModal', <TextInputModal key="x" visible title="rename album" onConfirm={jest.fn()} onCancel={jest.fn()} />],
  ['CapturePreview', <CapturePreview key="c" visible imageUri="file:///a.jpg" onSave={jest.fn()} onRetake={jest.fn()} />],
  ['ExportProgress', <ExportProgress key="p" visible label="exporting" current={1} total={2} onCancel={jest.fn()} />],
])('%s shows only lowercase copy', async (_name, ui) => {
  await render(<FontProvider>{ui}</FontProvider>);
  const texts = shown();
  expect(texts.length).toBeGreaterThan(0);
  expect(texts.filter((t) => t !== t.toLowerCase())).toEqual([]);
});

it("FaceTrendCard doesn't shout its label in uppercase", async () => {
  await render(
    <FontProvider>
      <FaceTrendCard photos={[]} trend={null} waiting={false} progress={{ scanning: false, done: 0, total: 0 }} onSelectDate={jest.fn()} onCompare={jest.fn()} />
    </FontProvider>,
  );
  expect(StyleSheet.flatten(screen.getByText('face width').props.style).textTransform).toBeUndefined();
});
