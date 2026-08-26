// src/lib/receiptStorage.ts
// Persists a receipt photo the user opted to keep, copying it out of the OS/picker's
// transient cache into the app's document directory so it survives after the add flow closes.
import { Directory, File, Paths } from 'expo-file-system';

function receiptsDir(): Directory {
  const dir = new Directory(Paths.document, 'receipts');
  dir.create({ idempotent: true });
  return dir;
}

function receiptFileName(mime: string): string {
  const ext = mime.includes('png') ? 'png' : 'jpg';
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return `${id}.${ext}`;
}

/** Copies the picked photo into permanent storage and returns its new URI. */
export function saveReceiptImage(sourceUri: string, mime: string): string {
  const dest = new File(receiptsDir(), receiptFileName(mime));
  new File(sourceUri).copy(dest);
  return dest.uri;
}

/** Removes a previously saved receipt photo. Safe to call on a URI that no longer exists,
 *  or on a platform (web) that never wrote one. */
export function deleteReceiptImage(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort cleanup: an already-missing file is not worth surfacing to the user.
  }
}
