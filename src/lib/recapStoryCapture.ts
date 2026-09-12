import { File } from 'expo-file-system';
import { Linking } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import type { RecapStoryCaptureAdapter } from './recapStoryCapture.types';
import { STORY_EXPORT_HEIGHT, STORY_EXPORT_WIDTH } from './recapStoryTheme';

export type NativeRecapStoryCaptureRef = Parameters<typeof captureRef>[0];

export const recapStoryCaptureAdapter: RecapStoryCaptureAdapter<NativeRecapStoryCaptureRef> = {
  capture(ref) {
    return captureRef(ref, {
      format: 'png',
      quality: 1,
      width: STORY_EXPORT_WIDTH,
      height: STORY_EXPORT_HEIGHT,
      result: 'tmpfile',
    });
  },

  canShare() {
    return Sharing.isAvailableAsync();
  },

  share(uri) {
    return Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
    });
  },

  async download(_uri, _filename) {
    throw new Error('Direct story downloads are only available on web');
  },

  async requestSavePermission() {
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    return permission.granted ? 'granted' : 'denied';
  },

  save(uri) {
    return MediaLibrary.saveToLibraryAsync(uri);
  },

  async cleanup(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },

  async openInstagram() {
    const instagramUrl = 'instagram://app';
    try {
      if (!(await Linking.canOpenURL(instagramUrl))) return false;
      await Linking.openURL(instagramUrl);
      return true;
    } catch {
      return false;
    }
  },
};

export default recapStoryCaptureAdapter;
