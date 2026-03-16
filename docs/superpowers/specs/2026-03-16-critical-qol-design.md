# Critical QoL Features — Design Spec

**Date:** 2026-03-16
**Status:** Approved
**Scope:** 14 critical quality-of-life improvements across 4 areas

---

## Overview

Polish pass on the Rewind app to make existing features feel complete. Covers camera/capture flow, photo viewing/browsing, timelapse export, and overall app feel.

---

## Section 1: Camera/Capture Flow

### 1.1 Mirror Toggle

**Problem:** Selfies are saved in a fixed orientation with no user control.

**Design:**
- Add a mirror icon button to `CapturePreview` (alongside retake/save)
- Only visible when `facing === 'front'` (back camera always saves as-is)
- Default: selfies save mirrored (matches viewfinder). Toggle flips to true orientation.
- The actual image bytes are horizontally flipped via `expo-image-manipulator` `FlipType.Horizontal` — not just a preview prop change — so the saved file matches what the user sees
- Preview updates in real-time so user sees exactly what will be saved
- Persist preference in `AppSettings.mirrorSelfies: boolean` (default `true`)

**Settings migration:** `loadSettings()` in `utils/storage.ts` must merge stored settings with `getDefaultSettings()` so existing users get `mirrorSelfies: true` instead of `undefined`. This merge pattern also future-proofs other new settings.

**Files affected:**
- `components/camera/CapturePreview.tsx` — add mirror button + flip logic
- `types/index.ts` — add `mirrorSelfies` to `AppSettings`
- `utils/storage.ts` — update `getDefaultSettings()` + add settings merge in `loadSettings()`
- `context/AppContext.tsx` — persist setting

### 1.2 Caption Editing After Save

**Problem:** Captions can only be set at capture time. No way to edit later.

**Design:**
- In `PhotoModal`, make caption text tappable → inline text input
- Empty caption shows "Add caption..." placeholder
- Saves on blur/done via `updatePhoto()` in AppContext
- Add `updatePhoto(id, updates)` method to AppContext if not present

**Files affected:**
- `components/timeline/PhotoModal.tsx` — tappable caption with edit mode
- `context/AppContext.tsx` — add `updatePhoto()` method

### 1.3 Delete Photo

**Problem:** No way to remove a photo once captured.

**Design:**
- Add trash icon to `PhotoModal` header
- Confirmation alert: "Delete this photo? This can't be undone."
- On confirm: remove from storage, close modal, refresh views
- Add `deletePhoto(id)` method to AppContext

**Files affected:**
- `components/timeline/PhotoModal.tsx` — trash icon + confirmation
- `context/AppContext.tsx` — add `deletePhoto()` method

### 1.4 Retake Confirmation

**Problem:** Tapping retake discards a typed caption without warning.

**Design:**
- In `CapturePreview`, if caption is non-empty and user taps "Retake", show: "You have an unsaved caption. Discard and retake?"
- If caption is empty, retake immediately (no friction)

**Files affected:**
- `components/camera/CapturePreview.tsx` — conditional alert before retake

### 1.5 Photo Quality Wired Up

**Problem:** Quality setting exists in UI but doesn't affect capture.

**Design:**
- Map existing `photoQuality` enum to `takePictureAsync()` quality param:
  - `'low'` = `quality: 0.5`
  - `'medium'` = `quality: 0.7`
  - `'high'` = `quality: 1.0`
- Read from `settings.photoQuality` at capture time in `doCapture()`

**Files affected:**
- `app/(tabs)/camera.tsx` — update `doCapture()` (line ~33) to read quality setting and pass to `takePictureAsync()`
- `context/AppContext.tsx` — ensure setting is accessible to camera screen

---

## Section 2: Viewing/Browsing Photos

### 2.1 Pinch-to-Zoom (Item 6)

**Problem:** Photos in modal are static, can't inspect details.

**Design:**
- Wrap photo in `PhotoModal` with gesture-enabled zoom view
- Use `react-native-gesture-handler` + `react-native-reanimated` (already Expo dependencies)
- Double-tap to zoom in/out, pinch to scale freely
- Clamp zoom 1x–4x, reset on modal close

**Dependencies:** `react-native-gesture-handler`, `react-native-reanimated` (likely already installed via Expo)

**Files affected:**
- `components/timeline/PhotoModal.tsx` — wrap image in zoomable container

### 2.2 Swipe Between Photos (Item 7)

**Problem:** Modal shows one photo at a time, must close and reopen to see another.

**Design:**
- Replace single-photo view with horizontal `FlatList` using `pagingEnabled`
- Pass full photo array + initial index to modal
- Swipe left/right to navigate between photos in current month
- Date label and caption update per photo on swipe
- Pinch-to-zoom works per page

**Gesture disambiguation:** When zoomed in (scale > 1), horizontal pan moves within the image. When at 1x zoom, horizontal swipe navigates between photos. This requires the zoom gesture handler to consume pan events when zoomed and release them when at rest.

**Files affected:**
- `components/timeline/PhotoModal.tsx` — refactor to paged list
- `app/album/[id].tsx` — pass full photos array + initial index to modal (this screen owns the `handleDayPress` that opens the modal, not CalendarGrid)

### 2.3 Photo Metadata Display (Item 8)

**Problem:** No context shown when viewing a photo.

**Design:**
- Below photo in modal, display:
  - Date: "March 14, 2026"
  - Time: "8:42 AM"
  - Day number: "Day 132"
- Subtle secondary text color, doesn't compete with image
- Uses existing `formatDateLabel()`, `formatTime()`, `getDayNumber()` utils
- Note: `getDayNumber(joinDate, currentDate)` requires `joinDate` from user profile — thread `profile.joinDate` through to PhotoModal via props or context

**Files affected:**
- `components/timeline/PhotoModal.tsx` — add metadata row, accept joinDate prop
- `app/album/[id].tsx` — pass joinDate to PhotoModal

### 2.4 Delete from Modal (Item 9)

Already covered by item 1.3 — same implementation, same file.

---

## Section 3: Timelapse

### 3.1 Export (Item 10)

**Problem:** Export button shows "Coming Soon" alert.

**Design:**
Four export formats via action sheet:

| Format | Description | Library |
|--------|-------------|---------|
| **GIF** | Animated, shareable, lightweight | `gifenc` (JS encoder) |
| **MP4 Video** | High quality video at selected speed | `expo-video-thumbnails` + canvas-based approach, or `react-native-video-encoder` (requires `expo prebuild` / dev build) |
| **Photo Album** | Individual frames saved to camera roll in a named "Rewind" album | `expo-media-library` |
| **Rewind Backup (.rewind)** | Zip archive with manifest + image files for app restore | `jszip` + `expo-file-system` + `expo-sharing` |

**Export flow:**
1. Tap export → action sheet with 4 options
2. Select format → progress overlay with percentage + **cancel button**
3. On complete → "Saved" toast + share option (for GIF/MP4/backup)
4. On cancel → clean up partial files, dismiss overlay
5. On failure → error message, clean up partial files, offer retry

**Export respects date range filter** (Section 3.3) — only exports photos within the currently selected range.

**GIF encoding constraints:**
- Resize frames to **480px wide** (maintain aspect ratio) via `expo-image-manipulator` before encoding
- Target frame rate: **4 fps** (matches timelapse playback feel)
- Maximum **500 frames** per GIF (warn user if range exceeds this)
- Process frames in batches of 10 to avoid JS thread freeze
- Show per-frame progress in overlay

**MP4 video approach:**
- Phase 1 (managed workflow): Use `expo-av` to create a slideshow video, or use a canvas-based frame encoder. Quality will be acceptable but not ideal.
- Phase 2 (dev build): If/when project moves to dev builds, switch to `react-native-video-encoder` or `ffmpeg-kit-react-native` for proper video encoding.
- Note: `ffmpeg-kit-react-native` is **incompatible with Expo managed workflow** — it requires native linking. Do NOT use without `expo prebuild`.

**Photo Album export:**
- Creates a named album "Rewind" in the device photo library (not dumped into main camera roll)
- Uses `expo-media-library` `createAlbumAsync()` / `addAssetsToAlbumAsync()`

**Backup format (.rewind):**
The `.rewind` file is a **zip archive** (not JSON with embedded base64) to avoid OOM on large collections:
```
rewind-backup.rewind (zip)
├── manifest.json
├── images/
│   ├── 2026-03-14.jpg
│   ├── 2026-03-15.jpg
│   └── ...
```

`manifest.json`:
```json
{
  "version": 1,
  "exportDate": "2026-03-16T10:00:00Z",
  "album": "daily-selfie",
  "photos": [
    {
      "id": "...",
      "date": "2026-03-14",
      "caption": "Good morning",
      "imageFile": "images/2026-03-14.jpg"
    }
  ]
}
```

Images are written individually to a temp directory, then zipped. This handles collections of 1000+ photos without memory issues.

**Temp file cleanup:** After export completes (or fails/cancels), delete the temp directory. On app launch, sweep `FileSystem.cacheDirectory + '/rewind-export/'` for stale files.

**Permissions:** Request `expo-media-library` write permission on first export.

**`app.json` plugin config required:**
```json
{
  "plugins": [
    ["expo-media-library", { "photosPermission": "Allow Rewind to save photos and timelapses to your library." }],
    "expo-document-picker"
  ]
}
```

**Dependencies:**
- `expo-media-library` (save to camera roll) — already installed
- `expo-file-system` (backup file creation) — already installed
- `expo-sharing` (share backup/GIF/MP4) — needs install
- `jszip` (zip archive creation for .rewind backup) — needs install
- `gifenc` (GIF encoding) — needs install
- `expo-image-manipulator` (resize frames for GIF) — needs install

**Files affected:**
- `app/(tabs)/timelapse.tsx` — replace alert with export action sheet
- `app.json` — add plugin entries for permissions
- New: `utils/export.ts` — export logic for all 4 formats
- New: `components/timelapse/ExportSheet.tsx` — action sheet UI
- New: `components/timelapse/ExportProgress.tsx` — progress overlay with cancel

### 3.2 Image Import

**Problem:** No way to add existing photos to an album.

**Design:**
- Import button on album detail screen
- Two import sources:
  - **Camera roll:** `expo-image-picker` with multi-select → auto-assign dates from EXIF metadata via `expo-media-library` asset info. For photos without EXIF dates, show a simple date picker. Batch-assign option: "Assign all remaining to today" to avoid tedious per-photo date picking.
  - **Rewind backup (.rewind):** `expo-document-picker` → extract zip, parse `manifest.json`, copy images to app storage, merge photos into album by date
- Imported photos merge into timeline by date, appear in calendar grid

**One-photo-per-day conflict:** The current `addPhoto()` in `AppContext.tsx` replaces any existing photo for the same date (`prev.filter(p => p.date !== entry.date)`). For imports:
- If the imported date already has a photo, **prompt the user per conflict**: "You already have a photo for March 14. Replace it or skip?"
- Provide a "Replace all" / "Skip all" option for bulk imports to avoid repetitive prompts
- The data model stays one-photo-per-day for now (changing to multi-photo-per-day is a larger architectural shift best deferred)

**Files affected:**
- `app/album/[id].tsx` — add import button
- `app.json` — add `expo-document-picker` plugin entry
- New: `utils/import.ts` — import logic for both sources, conflict resolution
- `context/AppContext.tsx` — add `importPhotos()` method with conflict callback

### 3.3 Date Range Selector (Item 11)

**Problem:** Timelapse always plays all photos, can't focus on a time period.

**Design:**
- Date range pill above player (e.g., "Nov 3 – Mar 16")
- Tap opens bottom sheet with start/end date pickers
- Only dates with photos are selectable
- Player, scrubber, filmstrip all filter to selected range
- Default: full range (all photos)

**Files affected:**
- New: `components/timelapse/DateRangeSheet.tsx` — bottom sheet with pickers
- `app/(tabs)/timelapse.tsx` — filter state + range pill
- `components/timelapse/TimelapsePlayer.tsx` — accept filtered frames
- `components/timelapse/Scrubber.tsx` — respect range bounds
- `components/timelapse/Filmstrip.tsx` — show filtered thumbnails

---

## Section 4: Overall App Feel

### 4.1 Empty States (Item 12)

**Problem:** Blank screens when user has no photos yet.

**Design per screen:**

| Screen | Empty State |
|--------|------------|
| **Home** | Icon + "Take your first photo to start your journey" + CTA button → camera tab |
| **Timelapse** | Redesign existing empty state — currently functional but should match the new `EmptyState` component style |
| **Albums** | "No albums yet" + prompt to take first photo or create album |
| **Calendar grid** | Grid structure visible, "No photos this month" centered |

- Consistent visual style: muted icon, descriptive text, optional CTA button
- New shared component: `components/ui/EmptyState.tsx`

**Files affected:**
- New: `components/ui/EmptyState.tsx` — reusable empty state component
- `app/(tabs)/index.tsx` — home empty state
- `app/(tabs)/timelapse.tsx` — timelapse empty state
- `app/(tabs)/albums.tsx` — albums empty state
- `components/timeline/CalendarGrid.tsx` — month empty state

### 4.2 Functional Notification Reminders (Item 13)

**Problem:** Reminders toggle exists but does nothing.

**Design:**
- Use `expo-notifications` for local scheduled notifications
- When toggle enabled → request permission → schedule daily notification
- Add reminder time picker to settings (uses existing `reminderTime: string` field in `AppSettings` — already defined in `types/index.ts` with default `"08:00"` in `utils/storage.ts`)
- When toggled off → cancel all scheduled notifications
- Notification message: rotating daily messages (e.g., "Time for today's photo!", "Don't break your streak!", etc.)

**`app.json` plugin config required:**
```json
{
  "plugins": [
    "expo-notifications"
  ]
}
```

**Dependencies:** `expo-notifications` (already installed)

**Files affected:**
- New: `utils/notifications.ts` — schedule/cancel notification logic
- `components/profile/SettingsList.tsx` — wire existing toggle to actual notification scheduling + add time picker
- `app.json` — add expo-notifications plugin entry

### 4.3 Haptic Feedback Consistency (Item 14)

**Problem:** Haptics are inconsistent — some elements have them, most don't.

**Design:**
- New utility: `utils/haptics.ts` with semantic methods:
  - `haptics.shutter()` — medium impact (photo capture)
  - `haptics.tap()` — light impact (buttons, tab switches)
  - `haptics.success()` — notification success (saved, exported)
  - `haptics.warning()` — notification warning (delete confirmation)
  - `haptics.error()` — notification error (permission denied)
- Apply across: shutter button, tab bar, all buttons, save/delete actions, export completion, toggle switches

**Dependencies:** `expo-haptics` (already installed — `package.json` confirms `expo-haptics: ~55.0.8`)

**Files affected:**
- New: `utils/haptics.ts` — haptic utility
- All interactive components — add appropriate haptic calls

---

## Dependencies Summary

**Already installed (no action needed):**

| Package | Used By |
|---------|---------|
| `expo-haptics` | Haptics (4.3) |
| `expo-image-picker` | Import (3.2) |
| `expo-media-library` | Export (3.1) |
| `expo-notifications` | Notifications (4.2) |
| `expo-file-system` | Export backup (3.1) |
| `react-native-gesture-handler` | Pinch-to-zoom (2.1) |
| `react-native-reanimated` | Pinch-to-zoom (2.1) |

**Need to install:**

| Package | Purpose | Required By |
|---------|---------|-------------|
| `expo-sharing` | Share exported files | Export (3.1) |
| `expo-document-picker` | Import .rewind files | Import (3.2) |
| `expo-image-manipulator` | Resize frames for GIF export | Export (3.1) |
| `jszip` | Zip archive for .rewind backup | Export (3.1), Import (3.2) |
| `gifenc` | GIF encoding | Export (3.1) |

---

## New Files Summary

| File | Purpose |
|------|---------|
| `utils/export.ts` | Export logic (GIF, MP4, album, backup) |
| `utils/import.ts` | Import logic (camera roll, .rewind) |
| `utils/notifications.ts` | Notification scheduling |
| `utils/haptics.ts` | Semantic haptic feedback |
| `components/ui/EmptyState.tsx` | Reusable empty state |
| `components/timelapse/ExportSheet.tsx` | Export format action sheet |
| `components/timelapse/ExportProgress.tsx` | Export progress overlay |
| `components/timelapse/DateRangeSheet.tsx` | Date range picker sheet |

---

## Type Changes

```typescript
// NEW field added to AppSettings (reminderEnabled + reminderTime already exist)
interface AppSettings {
  // ... existing fields (reminderEnabled, reminderTime, photoQuality, cloudBackup)
  mirrorSelfies: boolean;    // NEW — default: true
}
```

```typescript
// NEW methods added to AppContext
interface AppContextType {
  // ... existing methods
  updatePhoto: (id: string, updates: Partial<PhotoEntry>) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  importPhotos: (photos: PhotoEntry[], onConflict: (date: string) => Promise<'replace' | 'skip' | 'replace_all' | 'skip_all'>) => Promise<void>;
}
```

**Note:** `deletePhoto()` must also call `FileSystem.deleteAsync()` on the photo's `imageUri` to clean up the actual image file from disk, not just remove the entry from the array.
