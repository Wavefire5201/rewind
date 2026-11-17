// Release signing for Android builds, without hand-editing the generated android/ folder.
//
// Adds a `release` signing config to android/app/build.gradle that reads REWIND_UPLOAD_STORE_FILE,
// REWIND_UPLOAD_STORE_PASSWORD, REWIND_UPLOAD_KEY_ALIAS and REWIND_UPLOAD_KEY_PASSWORD from the
// environment, falling back to Gradle properties. Release builds use it when a store file is given
// (the release workflow sets these from the repo's secrets) and keep the debug key otherwise, so
// local builds work as before.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// rewind: release signing';
const prop = (name) => `System.getenv('REWIND_UPLOAD_${name}') ?: findProperty('REWIND_UPLOAD_${name}')`;

/** The generated build.gradle with release signing added. Applying it twice changes nothing. */
function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle;
  const debugConfig = /(signingConfigs \{\s*debug \{[^}]*\})/;
  const releaseUsesDebug = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!debugConfig.test(gradle) || !releaseUsesDebug.test(gradle)) {
    throw new Error("withReleaseSigning: android/app/build.gradle doesn't have the expected signingConfigs/buildTypes blocks");
  }
  const storeFile = `def rewindReleaseStore = ${prop('STORE_FILE')}`;
  return gradle
    .replace(/^(\s*)android \{/m, `${storeFile}\n\n$1android {`)
    .replace(debugConfig, `$1
        ${MARKER}
        release {
            if (rewindReleaseStore) {
                storeFile file(rewindReleaseStore)
                storePassword ${prop('STORE_PASSWORD')}
                keyAlias ${prop('KEY_ALIAS')}
                keyPassword ${prop('KEY_PASSWORD')}
            }
        }`)
    .replace(releaseUsesDebug, '$1signingConfig rewindReleaseStore ? signingConfigs.release : signingConfigs.debug');
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (c) => {
    c.modResults.contents = addReleaseSigning(c.modResults.contents);
    return c;
  });

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
