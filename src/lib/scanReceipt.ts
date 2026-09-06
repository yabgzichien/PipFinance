// src/lib/scanReceipt.ts
// Shared receipt-reading call used by both the camera capture and the gallery pick, mirroring
// ekyc/scan.ts. The photo is never stored: it is read once and the parsed lines are what the
// itemiser works from.
import { getLLM } from '../llm';
import { LLMError } from '../llm/types';
import type { ScannedReceipt } from './parseReceipt';

// On-device ML Kit OCR (src/lib/receiptOcr.ts) was tried as a cheaper front end for this call,
// but a real-device benchmark against the 4 images in `images test/` (tools/mlkit_eval) showed
// it badly garbling photographed receipts (0/19 items matched on the grocery receipt, at both
// downsampled and full resolution) even though the text pipeline itself works fine  it tied
// vision exactly on a clean e-wallet screenshot. So this stays vision-only for now; the OCR
// module is left in place, tested, for whenever that's revisited (e.g. for screenshots, or with
// image preprocessing).
export async function scanReceiptImage(image: { uri: string; base64: string; mime: string }): Promise<ScannedReceipt> {
  const llm = await getLLM();
  if (!llm.can('extractReceipt')) {
    throw new LLMError('no_key', "Reading receipts isn't available right now. You can still split the total by hand.");
  }
  return llm.extractReceipt({ parts: [{ kind: 'binary', base64: image.base64, mimeType: image.mime }] });
}
