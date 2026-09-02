// src/lib/scanReceipt.ts
// Shared receipt-reading call used by both the camera capture and the gallery pick, mirroring
// ekyc/scan.ts. The photo is never stored: it is read once and the parsed lines are what the
// itemiser works from.
import { getLLM } from '../llm';
import { LLMError } from '../llm/types';
import { recognizeReceiptText } from './receiptOcr';
import type { ScannedReceipt } from './parseReceipt';

/** Below this many characters, on-device OCR is treated as too thin to trust (a blurry photo, a
 *  receipt at a bad angle) and the read falls back to the vision model instead. */
const MIN_OCR_CHARS = 20;

export async function scanReceiptImage(image: { uri: string; base64: string; mime: string }): Promise<ScannedReceipt> {
  const llm = await getLLM();
  if (!llm.can('extractReceipt')) {
    throw new LLMError('no_key', "Reading receipts isn't available right now. You can still split the total by hand.");
  }

  // On-device OCR first: it's ~50% fewer tokens and >99% less upload than sending the photo
  // itself (evaluation_report.md). A thin or failed read falls back to the vision model rather
  // than risk a bad extraction.
  const ocr = await recognizeReceiptText(image.uri);
  if (ocr.status === 'ok' && ocr.text.length >= MIN_OCR_CHARS) {
    return llm.extractReceipt({ parts: [{ kind: 'text', text: ocr.text }] });
  }
  return llm.extractReceipt({ parts: [{ kind: 'binary', base64: image.base64, mimeType: image.mime }] });
}
