# Rewind

A photo-a-day app: take a consistent daily portrait, keep a streak, and stitch the
shots into a timelapse. Expo + React Native, dark theme, iOS/Android.

## Package Manager

Always use `bun` — never npm or npx. Use `bun install`, `bun run`, `bunx` for all operations.

## Commands

- `bun start` — Expo dev server (`bun run ios` / `bun run android` for native builds)
- `bun run start:mock` — dev server with `EXPO_PUBLIC_MOCK_DATA=1` (seeds mock photos/profile)
- `bunx tsc --noEmit` — typecheck (no test runner is configured)

There is no lint/test script. Verify changes by typechecking and running the app.

## Tech Stack

- **Expo SDK 55**, React Native 0.83, React 19, **expo-router** (file-based routing)
- **react-native-vision-camera** + MLKit face detector — capture & face alignment
- **react-native-reanimated 4** / **react-native-worklets 0.8** — animations & camera worklets
- **@shopify/react-native-skia** — timelapse rendering
- Persistence: **AsyncStorage** (metadata) + **expo-file-system** (photo files)
- Type-only `@/types` (`PhotoEntry`, `UserProfile`, `AppSettings`, `Album`)

## Architecture

- `app/` — expo-router screens. `(tabs)/` = home/camera/profile; `album/[id]`, `album/timelapse`, `album/settings`, `onboarding`.
- `components/` — grouped by domain: `camera/`, `timelapse/`, `timeline/`, `profile/`, `ui/`.
- `context/AppContext.tsx` — **single source of truth** for photos/profile/settings/albums. Loads from storage on mount; mutations update React state then persist via a fire-and-forget `fireAndSave` wrapper (errors log + haptic, never throw). Also owns album unlock state.
- `hooks/` — feature logic (`usePhotos`, `useStreak`, `useTimelapse`, `useFaceDetection`, `useAutoCapture`, `useAlbumLock`, `useGreeting`).
- `utils/` — pure-ish helpers (`storage`, `albums`, `dates`, `export`, `import`, `pin`, `notifications`, `imageSource`, `haptics`).
- `constants/theme.ts` — design tokens. `constants/mockData.ts` — `USE_MOCK_DATA` (env-gated) + fixtures.

## Conventions

- Import via the `@/` alias (maps to repo root) — `@/utils/storage`, `@/types`, etc.
- **Read/write app data through `AppContext`, not `utils/storage` directly**, so React state stays in sync. `storage.ts` is the persistence layer behind it.
- Use the `Colors` / `Typography` / `Spacing` / `BorderRadius` / `Sizes` tokens from `constants/theme.ts` — don't hardcode colors or font families (the app uses the CommitMono mono font throughout).
- Storage reads guard `JSON.parse` and fall back to empty/defaults on corruption — preserve that resilience.
- Haptics go through `utils/haptics` (`haptics.error()`, etc.), never `expo-haptics` directly.

## Gotchas

- **iOS build patch (`patches/expo-modules-core@*.patch`, applied automatically by `bun install`):** worklets 0.8 adds `SymbolType`/`ShareableType` to its `ValueType` enum, but expo-modules-core 55's `toObjCValueType` switch doesn't handle them — a non-exhaustive `enum class` switch that breaks the iOS build. The patch adds the two enum entries + switch cases and is **required for iOS builds** — do not remove it. It's a native `bun patch` (registered under `patchedDependencies` in `package.json`), so it applies deterministically on every install, cross-platform. To change it: `bun patch expo-modules-core`, edit the files, then `bun patch --commit node_modules/expo-modules-core`.
- **Ghost overlay alignment is unverified on hardware** — MLKit face detection is simulator-only; landmarks are stored in preview space, so toggling `mirrorSelfies` between capture and view can mirror X alignment. Needs a real-device test before trusting it. See `REFINEMENT_BACKLOG.md`.
- `REFINEMENT_BACKLOG.md` (untracked) tracks audit findings and remaining taste calls — check it for current status.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
