# Face Detection Core Features — Design Spec

**Date:** 2026-03-31
**Status:** Approved + CEO Review (Scope Expansion) + Eng Review + Design Review

## Overview

Migrate from expo-camera to react-native-vision-camera v4 to enable real-time face detection via MLKit frame processors. Build three core features on top: live face-tracked guide overlay, smart ghost alignment, and auto face centering on timelapse export.

Cross-platform (iOS + Android) via Google MLKit.

## 1. Camera Migration

### Replace expo-camera with react-native-vision-camera v4

**New dependencies:**
- `react-native-vision-camera` v4
- `react-native-worklets-core` (required for frame processors)
- `react-native-vision-camera-face-detector` (MLKit face detection frame processor)

**Files changed:**
- `components/camera/Viewfinder.tsx` — Rewrite to use `Camera` from vision-camera
  - `facing="front"` → `device={frontDevice}` via `useCameraDevice('front')`
  - `takePictureAsync()` → `takePhoto()`
  - Mirror transform via `Camera` props or post-capture flip (same as current)
  - Add frame processor for face detection
- `app/(tabs)/camera.tsx` — Update ref type from `CameraView` to `Camera`, update capture call
- Remove `expo-camera` dependency

**Files unchanged:**
- `GhostOverlay.tsx` — overlay rendering stays the same
- `GridOverlay.tsx` — unchanged
- `ShutterButton.tsx`, `CameraControls.tsx`, `TimerSelector.tsx`, `CapturePreview.tsx` — unchanged
- Photo save/storage logic — unchanged
- All non-camera screens — unchanged

### Permission handling

- vision-camera uses its own permission API: `Camera.requestCameraPermission()`
- Replace `useCameraPermissions()` from expo-camera with vision-camera equivalent
- Permission UI in Viewfinder stays the same visually

## 2. Face Detection Pipeline

### Frame processor

Each camera frame runs through a worklet that calls MLKit face detection:

```
camera frame → frame processor worklet → MLKit face detection → face landmarks
```

Landmarks flow into React via Reanimated shared values for 60fps overlay updates without bridge overhead.

**Critical:** Extract only the minimal landmark data (6 values: 2 eyes, nose, bounds, angles) inside the worklet. Do NOT pass the full MLKit response across the JS bridge — that's ~5KB per frame at 30fps = frame drops.

### Face landmark data model

```ts
interface FaceLandmarks {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  noseTip: { x: number; y: number };
  faceBounds: { x: number; y: number; width: number; height: number };
  rollAngle: number;   // head tilt
  yawAngle: number;    // head turn
}
```

### Storage

- Add optional `faceLandmarks?: FaceLandmarks` field to `PhotoEntry` type
- On capture, run face detection on the captured photo and store landmarks alongside the photo entry
- Landmarks stored in the same AsyncStorage/context as photo metadata

### Real-time usage

- Shared values updated every frame with latest face position
- Components (FaceGuide, GhostOverlay) read shared values for smooth animations
- No face detected → shared values set to null, components fall back to static behavior
- Multiple faces detected → use largest face (by bounding box area). Ignore others.

## 3. FaceGuide Enhancement

### Current behavior (broken)
- Static oval centered on the entire screen (not the camera view)
- Rendered as sibling of Viewfinder in camera.tsx — absoluteFill positions relative to wrong parent

### New behavior
- FaceGuide rendered INSIDE Viewfinder, positioned relative to camera view
- When face is detected: oval tracks the detected face bounding box in real-time
- Alignment feedback:
  - Subtle color shift (e.g., accent green) when face is well-centered and properly sized
  - Gentle directional indicators when off-center
- No face detected: falls back to static centered oval (but correctly positioned within camera view)
- Eye line and center crosshair remain as alignment aids

### Implementation
- FaceGuide accepts face landmark shared values as props
- Uses `Animated.View` (Reanimated) for smooth position/size updates
- Oval size interpolates between static default and detected face bounds

## 4. Smart Ghost Overlay

### Current behavior
- Static full-frame ghost image at configurable opacity
- No alignment to face position

### New behavior
- When BOTH conditions are met:
  1. Ghost photo has stored `FaceLandmarks` (from when it was captured)
  2. Live camera feed has a detected face
- Compute alignment transform:
  - Calculate scale factor from ghost eye distance vs live eye distance
  - Calculate translation to align ghost eye midpoint to live eye midpoint
  - Apply transform to ghost image
- Result: ghost image tracks your face, making it easy to match your previous position

### Fallback
- No face in ghost photo OR no face in live feed → static full-frame overlay (current behavior)
- Transform is purely visual — ghost image, opacity slider, and controls unchanged

### Implementation
- GhostOverlay receives live face landmarks (shared values) and ghost photo landmarks (static, from storage)
- Transform computed in worklet for performance
- Applied via Reanimated animated style on the ghost Image component

## 5. Auto Face Centering on Export

### Purpose
Produce stabilized timelapse videos where the face stays locked in position frame-to-frame, regardless of how the person was framed during capture.

### Algorithm
1. Define canonical face position: eyes at 40% from top, horizontally centered
2. For each frame with stored landmarks:
   - Compute eye midpoint from stored `leftEye` and `rightEye`
   - Compute scale to normalize eye distance to canonical value
   - Compute translation to move eye midpoint to canonical position
   - Compute rotation to normalize `rollAngle` to 0
3. Apply affine transform (scale + translate + rotate) per frame
4. Crop to consistent output dimensions

### Integration
- Applied during timelapse video export (in `utils/export.ts` or related)
- Optional toggle in export settings: "stabilize faces"
- Frames without landmark data are included without transform (graceful degradation)

### This is export-time only
- Does not change the timelapse preview/playback UI
- Produces a second "stabilized" export option alongside the raw export

## 6. Accepted Expansions (CEO Review)

### 6a. Auto-Capture at Alignment Threshold
When face detection determines the user's face matches the previous day's landmarks within a configurable threshold:
- Require 10+ consecutive aligned frames (~333ms at 30fps) before firing — prevents surprise/blurry captures
- Visual feedback: green ring fills around the FaceGuide oval as stability builds. User can cancel by moving.
- On ring complete: fire shutter with success haptic
- Mutual exclusion with timer countdown — if timer is active, auto-capture is disabled
- Debounce: minimum 2 seconds between auto-capture attempts
- Toggle in album settings (default: off)

### 6b. Alignment Haptics + Visual Feedback
As user moves toward target position:
- Graduated haptic feedback (light taps getting faster as alignment improves, "lock" vibration at perfect alignment)
- FaceGuide oval color shifts from default subtle to accent green as alignment improves
- Debounce haptics to prevent buzz from rapid face movement
- Cancel haptic sequence if face leaves frame
- Disable alignment haptics at >30° yaw angle (extreme head turn)

### 6c. Batch Landmark Backfill
Process existing photos in the background to detect and store face landmarks:
- Run on background thread with low priority (avoid blocking UI)
- Show progress indicator in settings or album view
- Resume from last processed photo if app is killed mid-backfill
- Skip photos where file is missing/corrupt, log warning
- Enables stabilized export for entire photo history, not just new photos

### 6d. Adaptive Ghost Opacity
Ghost overlay opacity responds dynamically to alignment quality:
- When alignment improves (face approaching target), ghost becomes more transparent (less guidance needed)
- When alignment drifts, ghost becomes more opaque (more guidance needed)
- Smooth animation via Reanimated
- Manual opacity slider still available as override
- Falls back to static opacity when no face detected in either ghost or live feed

### 6e. Auto Color/Exposure Normalization
Post-capture normalization (NOT real-time in viewfinder):
- After capture, compare brightness, white balance, and contrast to previous photo in album
- If difference exceeds threshold, apply subtle normalization filter before saving
- Skip normalization for first photo in album (no reference)
- Apply a threshold to avoid normalizing dramatic intentional changes
- Toggle in album settings (default: on)
- Handle OOM gracefully: skip normalization, save raw photo, log warning

## 7. Error Handling

All error paths must have explicit rescue actions. No silent failures.

| Error | Rescue Action | User Sees |
|-------|--------------|-----------|
| Camera permission revoked mid-session | Detect via app state listener, show re-prompt | "Camera access needed" overlay |
| Camera in use by other app | Catch init error, show message | "Camera is in use by another app" |
| MLKit model fails to load | Fallback to static face guide, show indicator | Small "face detection unavailable" badge |
| Multiple faces detected | Use largest face by bounding box area | Normal tracking (largest face) |
| Timer + auto-capture conflict | Timer takes priority, auto-capture disabled during countdown | Normal timer behavior |
| Duplicate auto-capture trigger | Debounce with 2-second minimum interval | Single capture |
| Storage full on capture | Pre-check available storage before capture | Alert: "Not enough storage" |
| Color normalization OOM | Skip normalization, save raw photo | Raw photo saved (no visual difference) |

## 8. Code Organization

Split Viewfinder complexity into focused hooks:
- `Viewfinder.tsx` — camera setup, permissions, photo capture (<100 lines)
- `hooks/useFaceDetection.ts` — frame processor + shared values + landmark extraction
- `hooks/useAutoCapture.ts` — alignment threshold + stability counter + ring fill + trigger
- `hooks/useColorNormalization.ts` — post-capture color comparison + normalization
- `utils/landmarks.ts` — pure functions for alignment score, affine transform computation

## 9. Testing Strategy

### Test infrastructure
- Add `vitest` as dev dependency
- Create `tests/` directory at project root

### Unit tests for utils/landmarks.ts
Pure function tests — the most critical code in the feature:

**computeAlignmentScore():**
- Perfect alignment (identical landmarks) → returns 1.0
- No previous landmarks → returns 0
- Extreme angle (>30° yaw) → returns 0
- Moderate offset → returns proportional score (0-1)

**computeAffineTransform():**
- Known input landmarks → correct scale + translate + rotate output
- Identity case (landmarks already at canonical position) → identity transform
- Very small face → bounded scale (no extreme zoom)
- Very large face → bounded scale

**computeColorDelta():**
- Same lighting → delta below threshold
- Different lighting → delta above threshold
- First photo (null reference) → returns null (skip)

## 10. Design Specifications

### Visual Style
All new elements follow the existing dark/minimal aesthetic:
- Ring fill: `Colors.accent` (#8FA67A), 2px stroke, no fill, easeInOut timing curve
- Face detection badge: top-left of viewfinder, `Colors.textTertiary` text, `Colors.bgPageTranslucent` background, CommitMono 10px
- FaceGuide oval: scales at 0.57 ratio of viewfinder width across all device sizes

### Ring Fill Animation
- Duration: ~333ms (10 frames at 30fps) for full fill when aligned
- On alignment break: hold current progress for 500ms, then smooth fade back over 300ms
- On completion: brief scale pulse (1.0 → 1.05 → 1.0 over 150ms) + success haptic
- Cooldown indicator: ring shows briefly in `Colors.textTertiary` (gray) during 2s cooldown, then disappears
- Stroke: 2px, no fill, positioned just outside the FaceGuide oval

### Haptic Pattern
Three intensity levels mapped to alignment quality:
- Far (score < 0.3): light tap every 400ms
- Close (score 0.3-0.7): medium tap every 200ms
- Aligned (score > 0.7): continuous light vibration → heavy impact on lock
- Platform abstraction: use existing `haptics.ts` utility (already handles iOS/Android differences)

### Adaptive Ghost Opacity
- Range: 0.15 (well-aligned, ghost nearly invisible) to 0.45 (drifting, ghost more visible)
- Easing: linear interpolation with smoothing factor 0.3 (responsive but not jittery)
- Manual opacity slider overrides dynamic behavior when user adjusts it
- Falls back to static manual value when no face detected

### Ghost Alignment Smoothing
- Lerp factor: 0.3 per frame (ghost position follows face with slight lag, prevents jitter)
- First detection: subtle scale-in animation (0.95 → 1.0 over 100ms) when ghost first aligns to face

### Batch Backfill Progress
- Location: toast-style banner at bottom of album view
- Style: `Colors.bgCard` background, CommitMono 11px, shows "{N} of {M} photos processed"
- On completion: "Done" text, auto-dismisses after 2 seconds
- On error: "Some photos skipped" with count, tap to dismiss

### Interaction State Table

| Feature | Loading | No Face | Error | Success | Partial |
|---------|---------|---------|-------|---------|---------|
| Face Guide | Static oval | Static oval | Static + "unavailable" badge | Tracking oval, accent green | Partial face: tracks but no haptics |
| Ring Fill | Hidden | Hidden | Hidden | Fills ~333ms, fires on complete | Hold 500ms then fade smoothly |
| Ghost Align | Static full-frame | Static full-frame | Static full-frame | Tracks face, smooth transform | Aligned but smoothed (lerp 0.3) |
| Adaptive Opacity | Manual slider value | Manual slider value | Manual slider value | Dynamic 0.15-0.45 | Slower transitions |
| Haptics | None | None | None | Graduated 3-level taps | Single light tap on face detect |
| Batch Backfill | "Processing..." indeterminate | "No photos" | "Some skipped" + count | "Done" auto-dismiss 2s | "{N} of {M}" progress |
| Color Norm | Processing indicator | Skip (1st photo) | Skip + save raw | Normalized in preview | Save raw + log warning |

### Accessibility
- Auto-capture fires: announce "Photo captured" via `AccessibilityInfo.announceForAccessibility()`
- Ring fill progress: exposed to screen readers as percentage via `accessibilityValue`
- Face detection status: "Face detected" / "No face detected" announced on state change (debounced 1s)

## 11. Architecture Summary

```
Camera Frame
    │
    ▼
Frame Processor (worklet) ──► Extract minimal landmarks only
    │
    ▼
MLKit Face Detection
    │
    ├──► Shared Values (Reanimated)
    │       │
    │       ├──► FaceGuide (live oval tracking + ring fill)
    │       ├──► GhostOverlay (live alignment transform + adaptive opacity)
    │       ├──► Alignment Haptics (graduated feedback)
    │       └──► Auto-Capture Controller (stability counter → trigger)
    │
    └──► On Capture:
            ├──► Color Normalization (compare to previous photo)
            ├──► Store FaceLandmarks in PhotoEntry
            └──► Export: auto face centering per frame

Background: Batch Backfill (process existing photos → store landmarks)
```

## 12. Build Order

0. **Install spike** — install vision-camera + worklets-core, verify basic capture works with Expo SDK 55 New Architecture
1. **Camera migration** — swap expo-camera for vision-camera, get basic capture working
2. **Frame processor setup** — add MLKit face detection, verify landmarks in console
3. **FaceGuide fix + enhancement** — move inside Viewfinder, add live face tracking
4. **Smart ghost overlay** — face-aligned ghost transform
5. **Landmark storage** — save landmarks per photo on capture
6. **Alignment haptics** — graduated feedback as face approaches target
7. **Auto-capture** — ring fill animation + stability threshold + shutter trigger
8. **Batch landmark backfill** — background processing of existing photos
9. **Adaptive ghost opacity** — alignment-responsive ghost transparency
10. **Color normalization** — post-capture brightness/WB matching
11. **Export centering** — stabilized face export option
12. **Test infrastructure** — add vitest, unit tests for utils/landmarks.ts (alignment score, affine transform, color delta)
13. **SQLite migration** — migrate photo/landmark storage from AsyncStorage to expo-sqlite for performance at scale

Steps 0-2 are sequential (foundation). After step 2, steps 3-4, 5-8, 6-7, and 10-12 can be parallelized across worktrees. Step 13 can be done anytime after step 5.
