import { StyleSheet } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import * as dates from '@/utils/dates';
import CalendarGrid from '@/components/timeline/CalendarGrid';
import { FontProvider } from '@/context/FontContext';
import type { PhotoEntry } from '@/types';

jest.mock('@/components/ui/PhotoImage', () => {
  const { View } = require('react-native');
  return (props: { source: { uri: string }; contentPosition?: object }) => (
    <View testID={`thumb:${props.source.uri}`} contentPosition={props.contentPosition} />
  );
});

function photo(date: string): PhotoEntry {
  return {
    id: `p-${date}`, albumId: 'a1', date, imageUri: `file:///document/${date}.jpg`,
    caption: '', capturedAt: `${date}T12:00:00.000Z`, cameraDirection: 'front',
  };
}

describe('CalendarGrid', () => {
  it('shows a photo even when its day is before the given start date', async () => {
    // Imported history predates the album; a captured day must never render as "before the album".
    await render(
      <FontProvider>
        <CalendarGrid year={2026} month={3} photos={[photo('2026-03-05')]} joinDate="2026-03-20" onDayPress={jest.fn()} />
      </FontProvider>,
    );
    expect(screen.getByTestId('thumb:file:///document/2026-03-05.jpg')).toBeTruthy();
  });

  it("shows a photo's thumbnail when it has one, not the full photo", async () => {
    const withThumb = { ...photo('2026-03-05'), thumbUri: 'file:///document/2026-03-05_thumb.jpg' };
    await render(
      <FontProvider>
        <CalendarGrid year={2026} month={3} photos={[withThumb, photo('2026-03-06')]} joinDate="2026-03-01" onDayPress={jest.fn()} />
      </FontProvider>,
    );
    expect(screen.getByTestId('thumb:file:///document/2026-03-05_thumb.jpg')).toBeTruthy();
    // Not made yet: the full photo, as before.
    expect(screen.getByTestId('thumb:file:///document/2026-03-06.jpg')).toBeTruthy();
  });

  it('crops a tall photo around the face, not the middle', async () => {
    const tall = {
      ...photo('2026-03-05'),
      faceScan: { v: 1, eyes: { left: { x: 0.4, y: 0.4 }, right: { x: 0.6, y: 0.4 } }, width: 1000, height: 2000 },
    };
    await render(
      <FontProvider>
        <CalendarGrid year={2026} month={3} photos={[tall]} joinDate="2026-03-01" onDayPress={jest.fn()} />
      </FontProvider>,
    );
    expect(screen.getByTestId('thumb:file:///document/2026-03-05.jpg').props.contentPosition).toEqual({ left: '50%', top: '40%' });
  });

  it("draws a missed day's border inside the cell, so it sizes like the photo next to it", async () => {
    // Yoga floors a flex item's base size at its own border: with the border on the cell,
    // a missed day came out 2dp wider (and, square, taller) than its neighbours.
    await render(
      <FontProvider>
        <CalendarGrid year={2026} month={3} photos={[photo('2026-03-05')]} joinDate="2026-03-01" onDayPress={jest.fn()} />
      </FontProvider>,
    );
    const cell = StyleSheet.flatten(screen.getByTestId('missed-2026-03-04').props.style);
    expect(cell.borderWidth ?? 0).toBe(0);
    expect(StyleSheet.flatten(screen.getByTestId('missed-border-2026-03-04').props.style).borderWidth).toBe(1);
  });
});

describe('opening days', () => {
  beforeEach(() => jest.spyOn(dates, 'getToday').mockReturnValue('2026-03-06'));
  afterEach(() => jest.restoreAllMocks());

  it('every day from the start through today can be opened, and no other', async () => {
    const onDayPress = jest.fn();
    await render(
      <FontProvider>
        <CalendarGrid year={2026} month={3} photos={[photo('2026-03-05')]} joinDate="2026-03-02" onDayPress={onDayPress} />
      </FontProvider>,
    );
    await act(async () => fireEvent.press(screen.getByTestId('missed-2026-03-03')));
    await act(async () => fireEvent.press(screen.getByTestId('today-2026-03-06')));
    expect(onDayPress.mock.calls).toEqual([['2026-03-03'], ['2026-03-06']]);
    // Before the album's start, and after today: nothing to open.
    expect(screen.queryByTestId('missed-2026-03-01')).toBeNull();
    expect(screen.queryByTestId('missed-2026-03-07')).toBeNull();
    expect(screen.queryByTestId('today-2026-03-07')).toBeNull();
  });

  it('a day with a weight but no photo shows a dot', async () => {
    await render(
      <FontProvider>
        <CalendarGrid
          year={2026} month={3} photos={[photo('2026-03-05')]} joinDate="2026-03-01"
          weightDates={new Set(['2026-03-03', '2026-03-05', '2026-03-06'])} onDayPress={jest.fn()}
        />
      </FontProvider>,
    );
    expect(screen.getByTestId('weight-dot:2026-03-03')).toBeTruthy();
    expect(screen.getByTestId('weight-dot:2026-03-06')).toBeTruthy();
    // The photo shows that day already.
    expect(screen.queryByTestId('weight-dot:2026-03-05')).toBeNull();
  });
});
