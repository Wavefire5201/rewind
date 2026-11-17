import { bumpVersion } from '../../scripts/version';

const app = { expo: { name: 'Rewind', version: '1.0.0', android: { package: 'com.rewind.app', versionCode: 1 } } };
const pkg = { name: 'rewind', version: '1.0.0', scripts: {} };

it('sets both versions and counts the Android build number up', () => {
  const next = bumpVersion(app, pkg, '1.1.0');
  expect(next.app.expo.version).toBe('1.1.0');
  expect(next.app.expo.android.versionCode).toBe(2);
  expect(next.app.expo.android.package).toBe('com.rewind.app');
  expect(next.pkg.version).toBe('1.1.0');
  // The inputs are left alone.
  expect(app.expo.version).toBe('1.0.0');
});

it('starts the build number at 1 when there is none', () => {
  const noCode = { expo: { version: '1.0.0', android: { package: 'com.rewind.app' } as { package: string; versionCode?: number } } };
  expect(bumpVersion(noCode, pkg, '1.0.1').app.expo.android.versionCode).toBe(1);
});

it("refuses a version that isn't x.y.z or isn't after the current one", () => {
  expect(() => bumpVersion(app, pkg, '1.0')).toThrow('not a version: 1.0');
  expect(() => bumpVersion(app, pkg, 'v1.2.0')).toThrow('not a version');
  expect(() => bumpVersion(app, pkg, '0.9.0')).toThrow('0.9.0 is not after 1.0.0');
  expect(() => bumpVersion(app, pkg, '1.0.0')).toThrow('1.0.0 is not after 1.0.0');
  // Numbers, not strings: 1.10.0 comes after 1.9.0.
  expect(bumpVersion({ expo: { version: '1.9.0', android: {} } }, pkg, '1.10.0').app.expo.version).toBe('1.10.0');
});
