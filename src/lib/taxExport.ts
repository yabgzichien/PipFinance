// src/lib/taxExport.ts
// Builds the per-YA audit pack: a real PDF (not an HTML-print stand-in, unlike the general
// financial export) bundling every tagged transaction's evidence images plus a summary table
// keyed by Form BE line. pdf-lib is pure JS: no native module, works the same on web and
// native via the app's existing saveOrDownloadExport (financialExport.ts:1372).
import { File } from 'expo-file-system';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { computeUsage } from './relief';
import type { ReliefSchedule } from './reliefSchedule';
import type { ReliefTag, Transaction } from './types';

function readImageBytes(uri: string): Uint8Array | null {
  try {
    const file = new File(uri);
    if (!file.exists) return null;
    return file.bytesSync();
  } catch {
    return null;
  }
}

async function embedImage(doc: PDFDocument, uri: string) {
  const bytes = readImageBytes(uri);
  if (!bytes) return null;
  try {
    return uri.toLowerCase().endsWith('.png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function buildAuditPackPdf(
  ya: number,
  schedule: ReliefSchedule,
  tags: ReliefTag[],
  transactions: Transaction[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const usage = computeUsage(tags, schedule);
  const usageByCode = Object.fromEntries(usage.map((u) => [u.code, u]));

  // --- Summary page ---------------------------------------------------------------------
  const summary = doc.addPage([595, 842]); // A4
  let y = 800;
  summary.drawText(`Tax relief audit pack: YA ${ya}`, { x: 40, y, size: 16, font: bold });
  y -= 30;
  for (const line of schedule.lines) {
    const u = usageByCode[line.code];
    if (!u) continue;
    const prefix = line.parent ? '  ' : '';
    summary.drawText(
      `${prefix}${line.formField}  ${line.label}: RM ${u.capUsed.toFixed(2)} / RM ${u.cap.toFixed(2)}`,
      { x: 40, y, size: 10, font }
    );
    y -= 16;
    if (y < 60) break; // summary is a short table by design; overflow is not expected for v1's line count
  }

  // --- One block per tagged transaction --------------------------------------------------
  for (const tag of tags) {
    const txn = transactions.find((t) => t.id === tag.txnId);
    const line = schedule.lines.find((l) => l.code === tag.code);
    if (!txn || txn.currency !== 'MYR' || !line) continue;

    const page = doc.addPage([595, 842]);
    let py = 800;
    page.drawText(`${txn.merchantRaw || line.label}`, { x: 40, y: py, size: 14, font: bold });
    py -= 20;
    page.drawText(`${line.formField}  ${line.label}`, { x: 40, y: py, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    py -= 16;
    page.drawText(`Date: ${txn.date ?? 'unknown'}    Amount claimed: RM ${tag.amount.toFixed(2)}`, { x: 40, y: py, size: 11, font });
    py -= 24;

    const images: { label: string; uri: string }[] = [];
    if (txn.receiptUri) images.push({ label: 'Receipt', uri: txn.receiptUri });
    if (tag.certImageUri) images.push({ label: 'Certification', uri: tag.certImageUri });
    if (tag.einvoiceImageUri) images.push({ label: 'e-Invoice', uri: tag.einvoiceImageUri });

    for (const img of images) {
      const embedded = await embedImage(doc, img.uri);
      page.drawText(img.label, { x: 40, y: py, size: 10, font: bold });
      py -= 14;
      if (!embedded) {
        page.drawText('(image unavailable)', { x: 40, y: py, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
        py -= 20;
        continue;
      }
      const maxWidth = 300;
      const maxHeight = 400;
      const scale = Math.min(1, maxWidth / embedded.width, maxHeight / embedded.height);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      if (py - h < 40) {
        // doesn't fit on this page even after capping both dimensions; note it and keep
        // going so later, possibly-smaller images for this transaction still get a chance
        page.drawText('(image too large for this page)', { x: 40, y: py, size: 9, font, color: rgb(0.6, 0.6, 0.6) });
        py -= 20;
        continue;
      }
      page.drawImage(embedded, { x: 40, y: py - h, width: w, height: h });
      py -= h + 20;
    }
  }

  return doc.save();
}
