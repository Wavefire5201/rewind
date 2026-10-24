// NOTE: jest.resetModules() + require() below is deliberate. utils/haptics keeps
// module-level debounce state (lastAlignmentHaptic), so each test gets a fresh
// copy. After a reset, `import * as Haptics` at the top of this file would point
// at STALE mock fns — always assert via jest.requireMock (same instance the
// fresh utils/haptics is bound to).

let haptics: typeof import('@/utils/haptics').haptics;
let ExpoHaptics: {
  impactAsync: jest.Mock;
  notificationAsync: jest.Mock;
  selectionAsync: jest.Mock;
  performAndroidHapticsAsync: jest.Mock;
};
const onAndroid = () => jest.replaceProperty(require('react-native').Platform, 'OS', 'android');
const androidCalls = () => ExpoHaptics.performAndroidHapticsAsync.mock.calls.map((c) => c[0]);
/** Lets a rejected haptic's fallback run. */
const settle = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
let now = 10_000;

beforeEach(() => {
  jest.resetModules();
  now = 10_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  haptics = require('@/utils/haptics').haptics;
  ExpoHaptics = jest.requireMock('expo-haptics');
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('haptics', () => {
  it('maps each named haptic on Android to one system haptic', () => {
    onAndroid();
    haptics.tap(); haptics.tick(); haptics.shutter(); haptics.success(); haptics.error();
    expect(androidCalls()).toEqual(['context-click', 'segment-tick', 'long-press', 'confirm', 'reject']);
    expect(ExpoHaptics.notificationAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('maps each named haptic on iOS to the Taptic Engine', () => {
    haptics.tap(); haptics.tick(); haptics.shutter(); haptics.success(); haptics.error();
    expect(ExpoHaptics.impactAsync.mock.calls.map((c) => c[0])).toEqual(['light', 'medium']);
    expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(ExpoHaptics.notificationAsync.mock.calls.map((c) => c[0])).toEqual(['success', 'error']);
    expect(ExpoHaptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['success', 'confirm', 'virtual-key'],
    ['error', 'reject', 'long-press'],
    ['tick', 'segment-tick', 'clock-tick'],
  ] as const)('falls back when the Android version lacks the %s haptic', async (name, first, fallback) => {
    onAndroid();
    ExpoHaptics.performAndroidHapticsAsync.mockRejectedValueOnce(new Error('not supported'));
    haptics[name]();
    await settle();
    expect(androidCalls()).toEqual([first, fallback]);
  });

  it('swallows a failed fallback', async () => {
    onAndroid();
    ExpoHaptics.performAndroidHapticsAsync.mockRejectedValue(new Error('no haptics'));
    expect(() => haptics.success()).not.toThrow();
    await settle();
    expect(androidCalls()).toEqual(['confirm', 'virtual-key']);
  });

  it('has no warning haptic', () => {
    expect((haptics as Record<string, unknown>).warning).toBeUndefined();
  });

  it('grades alignment on Android from a light tick to a frequent tick', () => {
    onAndroid();
    haptics.alignment(0.1);
    now += 500;
    haptics.alignment(0.5);
    now += 500;
    haptics.alignment(0.9);
    expect(androidCalls()).toEqual(['clock-tick', 'segment-tick', 'segment-frequent-tick']);
    expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
    expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('fires high alignment scores immediately via selection feedback', () => {
    haptics.alignment(0.9);
    haptics.alignment(0.95);
    expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it('debounces low scores at 400ms and mid scores at 200ms', () => {
    haptics.alignment(0.1); // fires (last=0, now=10000)
    expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);

    now += 100;
    haptics.alignment(0.1); // suppressed
    expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(1);

    now += 150; // 250ms since last → mid tier (200ms) fires
    haptics.alignment(0.5);
    expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(2);

    now += 100;
    haptics.alignment(0.1); // only 100ms since last → suppressed
    expect(ExpoHaptics.impactAsync).toHaveBeenCalledTimes(2);
  });
});
