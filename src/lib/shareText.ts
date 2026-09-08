// src/lib/shareText.ts
// Hands a split message to the OS share sheet. Delivery only: every decision about what the
// message says lives in lib/splitMessage.ts, which is pure and unit-tested. Nothing here
// branches on content, so there is no logic to test behind the platform APIs.
//
// Why the receipt photo and the text travel separately: Android's share sheet takes a stream
// or a text body, not both. `expo-sharing` sends the file and drops any caption; React Native's
// own text share drops the file. So when there is a photo to send, the breakdown goes to the
// clipboard and the photo goes to the sheet, and the caller tells the user to paste it into the
// caption box (WhatsApp opens one for exactly this). With no photo it is a plain text share and
// nothing touches the clipboard.
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

export type ShareOutcome =
  /** Text went straight into the share sheet. Nothing to paste. */
  | 'shared'
  /** The photo is in the share sheet and the message is on the clipboard, waiting to be pasted. */
  | 'shared-with-clipboard'
  /** Nothing could be opened. The message is on the clipboard so the user still has it. */
  | 'copied'
  | 'failed';

async function copy(message: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(message);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the OS share sheet for a split message, with the receipt photo attached when there
 * is one. Returns what actually happened so the caller can tell the user whether they still
 * need to paste.
 *
 * Never throws: a user who dismisses the sheet is not an error, and neither is a device with
 * no sharing available.
 */
export async function shareSplitMessage(
  message: string,
  receiptUri?: string | null
): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    return (await copy(message)) ? 'copied' : 'failed';
  }

  if (receiptUri) {
    const available = await Sharing.isAvailableAsync().catch(() => false);
    if (available) {
      const copied = await copy(message);
      const isPng = receiptUri.toLowerCase().endsWith('.png');
      try {
        await Sharing.shareAsync(receiptUri, {
          mimeType: isPng ? 'image/png' : 'image/jpeg',
          UTI: isPng ? 'public.png' : 'public.jpeg',
        });
        return copied ? 'shared-with-clipboard' : 'shared';
      } catch {
        return copied ? 'copied' : 'failed';
      }
    }
    // No file sharing on this device: fall through and send the text on its own rather than
    // dropping the whole share because the photo could not go.
  }

  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return (await copy(message)) ? 'copied' : 'failed';
  }
}
