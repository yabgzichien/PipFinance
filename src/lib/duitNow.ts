// src/lib/duitNow.ts
// Persists the user's personal DuitNow QR code image, copying it from the image picker's
// transient cache into the app's document directory so it survives app restarts.
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export const DUITNOW_QR_META_KEY = 'duitnow_qr_uri';

function duitNowDir(): Directory {
  const dir = new Directory(Paths.document, 'duitnow');
  dir.create({ idempotent: true });
  return dir;
}

/** Copies the picked DuitNow QR image into permanent storage and returns its URI. */
export function saveDuitNowQrImage(sourceUri: string, mime?: string): string {
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const ext = mime?.includes('png') || sourceUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const dest = new File(duitNowDir(), `duitnow_qr_${Date.now()}.${ext}`);
  new File(sourceUri).copy(dest);
  return dest.uri;
}

/** Removes a previously saved DuitNow QR image. Safe to call on null or missing files. */
export function deleteDuitNowQrImage(uri?: string | null): void {
  if (!uri || Platform.OS === 'web') return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup
  }
}
