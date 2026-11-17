#!/usr/bin/env bash
# Passes only if APK verifies and is signed with the expected certificate (its SHA-256 digest).
# The release workflow runs it before publishing, so an APK that wouldn't install over the
# previous release (debug-signed, or signed with any other key) is never published.
#
# Usage: scripts/check-apk-signature.sh APK EXPECTED_CERT_SHA256
# APKSIGNER overrides the apksigner binary (default: the newest under $ANDROID_HOME/build-tools).
set -euo pipefail

apk=${1:?usage: check-apk-signature.sh APK EXPECTED_CERT_SHA256}
expected=$(printf '%s' "${2:?expected certificate SHA-256 missing}" | tr -d ':' | tr 'A-F' 'a-f')
apksigner=${APKSIGNER:-$(ls "${ANDROID_HOME:?ANDROID_HOME not set}"/build-tools/*/apksigner | sort -V | tail -1)}

[ -f "$apk" ] || { echo "::error::no APK at $apk"; exit 1; }

if ! out=$("$apksigner" verify --print-certs "$apk" 2>&1); then
  echo "$out"
  echo "::error::$apk doesn't verify"
  exit 1
fi
echo "$out"
digests=$(printf '%s\n' "$out" | sed -n 's/^Signer #[0-9]* certificate SHA-256 digest: //p')
if [ "$digests" != "$expected" ]; then
  echo "::error::$apk is signed with '${digests:-nothing}', not the release key ($expected)"
  exit 1
fi
echo "signature ok: release key $expected"
