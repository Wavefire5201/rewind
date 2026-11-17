// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addReleaseSigning } = require('../../plugins/withReleaseSigning') as { addReleaseSigning: (gradle: string) => string };

// The blocks expo prebuild generates in android/app/build.gradle (SDK 57).
const GENERATED = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
        }
    }
}`;

it('adds a release signing config read from REWIND_UPLOAD_* (environment first, then Gradle properties)', () => {
  const out = addReleaseSigning(GENERATED);
  expect(out).toMatch(/signingConfigs \{[\s\S]*release \{[\s\S]*storeFile file\(rewindReleaseStore\)/);
  for (const name of ['STORE_FILE', 'STORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']) {
    expect(out).toContain(`System.getenv('REWIND_UPLOAD_${name}') ?: findProperty('REWIND_UPLOAD_${name}')`);
  }
});

it('signs release builds with it only when a store file is given, and with the debug key otherwise', () => {
  const out = addReleaseSigning(GENERATED);
  const release = out.slice(out.indexOf('buildTypes'));
  expect(release).toMatch(/release \{[\s\S]*signingConfig rewindReleaseStore \? signingConfigs\.release : signingConfigs\.debug/);
  // Debug builds keep the debug key.
  expect(release).toMatch(/debug \{\s*signingConfig signingConfigs\.debug\s*\}/);
});

it('is idempotent: running prebuild again changes nothing', () => {
  const once = addReleaseSigning(GENERATED);
  expect(addReleaseSigning(once)).toBe(once);
});

it('fails loudly when the generated file no longer has the expected blocks', () => {
  expect(() => addReleaseSigning('android {}')).toThrow(/withReleaseSigning/);
});
