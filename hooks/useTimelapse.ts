import { useState, useRef, useCallback, useMemo } from 'react';
import type { PhotoEntry } from '@/types';
import { TimelapsePlayerHandle } from '@/components/timelapse/TimelapsePlayer';

/** While playing, the filmstrip (FlatList scroll + re-render) follows at most this often. */
export const FILMSTRIP_THROTTLE_MS = 500;

export function formatMMDD(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

interface UseTimelapseOptions {
  photos: PhotoEntry[];
}

export function useTimelapse({ photos }: UseTimelapseOptions) {
  const [speed, setSpeed] = useState(1);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [filmstripIndex, setFilmstripIndex] = useState(0);
  const isPlayingRef = useRef(false);
  const lastFilmstripAtRef = useRef(0);
  // The frame on screen. While playing it only lives here: the picture, counter and scrubber
  // follow the player's shared frame on the UI thread, so React state catches up on pause.
  const shownIndexRef = useRef(0);
  const playerRef = useRef<TimelapsePlayerHandle>(null);

  // Date range
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [showDateRange, setShowDateRange] = useState(false);

  // Derived
  const allDates = useMemo(() => photos.map((p) => p.date).sort(), [photos]);
  const rangeStart = dateRange?.start ?? (allDates[0] ?? '');
  const rangeEnd = dateRange?.end ?? (allDates[allDates.length - 1] ?? '');
  const filteredPhotos = useMemo(
    () => dateRange
      ? photos.filter((p) => p.date >= dateRange.start && p.date <= dateRange.end)
      : photos,
    [photos, dateRange],
  );
  const hasDateFilter = dateRange !== null;

  const showIndex = useCallback((index: number) => {
    shownIndexRef.current = index;
    setDisplayIndex(index);
    setFilmstripIndex(index);
  }, []);

  // Frames arrive ~10x/s while playing. Re-rendering the whole screen for each cost work
  // on both threads, so then only the filmstrip follows, at most every
  // FILMSTRIP_THROTTLE_MS; when paused, everything follows exactly.
  const handleFrameChange = useCallback((index: number) => {
    if (!isPlayingRef.current) {
      showIndex(index);
      return;
    }
    shownIndexRef.current = index;
    const now = Date.now();
    if (now - lastFilmstripAtRef.current >= FILMSTRIP_THROTTLE_MS) {
      lastFilmstripAtRef.current = now;
      setFilmstripIndex(index);
    }
  }, [showIndex]);

  const handlePlayingChange = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlaying(playing);
    if (!playing) showIndex(shownIndexRef.current);
  }, [showIndex]);

  const handlePlaybackEnd = showIndex;

  const handleSeek = useCallback((index: number) => {
    showIndex(index);
    playerRef.current?.seekTo(index);
  }, [showIndex]);

  const handleFilmstripSelect = handleSeek;

  const handleSpeedSelect = useCallback((s: number) => setSpeed(s), []);

  function handleDateRangeApply(start: string, end: string) {
    const isAll = start === allDates[0] && end === allDates[allDates.length - 1];
    setDateRange(isAll ? null : { start, end });
    setShowDateRange(false);
    setDisplayIndex(0);
    setFilmstripIndex(0);
    playerRef.current?.seekTo(0);
  }

  function resetForAlbum() {
    setDateRange(null);
    setDisplayIndex(0);
    setFilmstripIndex(0);
    playerRef.current?.seekTo(0);
  }

  return {
    /** Every photo in the album, before the date-range filter (the face trend is fitted on these). */
    albumPhotos: photos,
    playerRef,
    speed,
    displayIndex,
    isPlaying,
    filmstripIndex,
    filteredPhotos,
    allDates,
    rangeStart,
    rangeEnd,
    hasDateFilter,
    showDateRange,
    setShowDateRange,
    handleFrameChange,
    handlePlayingChange,
    handlePlaybackEnd,
    handleSeek,
    handleFilmstripSelect,
    handleSpeedSelect,
    handleDateRangeApply,
    resetForAlbum,
  };
}
