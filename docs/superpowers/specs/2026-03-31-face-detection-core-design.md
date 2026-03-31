# Face Detection Core Features — Design Spec

**Date:** 2026-03-31
**Status:** Approved

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

## Architecture Summary

```
Camera Frame
    │
    ▼
Frame Processor (worklet)
    │
    ▼
MLKit Face Detection
    │
    ├──► Shared Values (Reanimated)
    │       │
    │       ├──► FaceGuide (live oval tracking)
    │       └──► GhostOverlay (live alignment transform)
    │
    └──► On Capture: store FaceLandmarks in PhotoEntry
                │
                └──► Export: auto face centering per frame
```

## Build Order

1. **Camera migration** — swap expo-camera for vision-camera, get basic capture working
2. **Frame processor setup** — add MLKit face detection, verify landmarks in console
3. **FaceGuide fix + enhancement** — move inside Viewfinder, add live face tracking
4. **Smart ghost overlay** — face-aligned ghost transform
5. **Landmark storage** — save landmarks per photo on capture
6. **Export centering** — stabilized face export option

Each step is independently testable and shippable.
