import type { ImageSource } from 'expo-image';

export function getImageSource(uri: string): ImageSource {
  // All URIs are either https:// (Unsplash/mock) or file:// (real captured photos)
  return { uri };
}
