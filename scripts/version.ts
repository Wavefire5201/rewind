/**
 * Bumps the app's version in one go: `bun run version 1.1.0`.
 * Sets `expo.version` in app.json and `version` in package.json, and counts the Android build number
 * (`expo.android.versionCode`) up by one, so each release installs over the last.
 * Then commit, tag `v1.1.0`, and push the tag: the release workflow builds the APK.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type AppJson = { expo: { version: string; android: { versionCode?: number } & Record<string, unknown> } & Record<string, unknown> };
type PackageJson = { version: string } & Record<string, unknown>;

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parts(version: string): number[] {
  const m = SEMVER.exec(version);
  if (!m) throw new Error(`not a version: ${version} (expected x.y.z)`);
  return m.slice(1).map(Number);
}

function isAfter(next: string, current: string): boolean {
  const [a, b] = [parts(next), parts(current)];
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The two files with `next` as the version; throws for a malformed or not-newer version. */
export function bumpVersion<A extends AppJson, P extends PackageJson>(app: A, pkg: P, next: string): { app: A; pkg: P } {
  parts(next);
  const current = app.expo.version;
  if (!isAfter(next, current)) throw new Error(`${next} is not after ${current}`);
  const versionCode = app.expo.android.versionCode === undefined ? 1 : app.expo.android.versionCode + 1;
  return {
    app: { ...app, expo: { ...app.expo, version: next, android: { ...app.expo.android, versionCode } } },
    pkg: { ...pkg, version: next },
  };
}

if (process.argv[1]?.endsWith('version.ts')) {
  const next = process.argv[2];
  if (!next) {
    console.error('usage: bun run version x.y.z');
    process.exit(1);
  }
  const root = join(__dirname, '..');
  const appPath = join(root, 'app.json');
  const pkgPath = join(root, 'package.json');
  try {
    const out = bumpVersion(JSON.parse(readFileSync(appPath, 'utf8')), JSON.parse(readFileSync(pkgPath, 'utf8')), next);
    writeFileSync(appPath, `${JSON.stringify(out.app, null, 2)}\n`);
    writeFileSync(pkgPath, `${JSON.stringify(out.pkg, null, 2)}\n`);
    console.log(`version ${next} (build ${out.app.expo.android.versionCode}). commit, then: git tag v${next} && git push origin v${next}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
