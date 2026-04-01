// Exclude react-native-vision-camera-face-detector from iOS autolinking
// MLKit doesn't ship simulator-compatible frameworks, so this pod breaks
// simulator builds. Face detection is loaded at runtime via try/catch require.
// For device builds: remove this exclusion and run pod install.
module.exports = {
  dependencies: {
    'react-native-vision-camera-face-detector': {
      platforms: {
        ios: null, // Exclude from iOS autolinking (MLKit doesn't support simulator)
      },
    },
  },
};
