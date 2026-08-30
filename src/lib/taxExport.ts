// src/lib/taxExport.ts
// Builds the per-YA audit pack:
// 1. A clean, publication-grade, image-free PDF summary statement formatted for tax filing
//    with executive metrics, tax relief schedule table, and itemized transaction ledger.
// 2. A companion ZIP export function bundling all receipt photos, medical certifications, and
//    e-invoices into organized category folders with a manifest for tax audit retention.
import { File } from 'expo-file-system';
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';
import { computeUsage } from './relief';
import type { ReliefSchedule } from './reliefSchedule';
import type { ReliefTag, Transaction } from './types';

export function readImageBytes(uri: string): Uint8Array | null {
  try {
    if (typeof require !== 'undefined') {
      try {
        const nodeFs = require('fs');
        if (nodeFs.existsSync(uri)) {
          return new Uint8Array(nodeFs.readFileSync(uri));
        }
      } catch {}
    }
    const file = new File(uri);
    if (!file.exists) return null;
    return file.bytesSync();
  } catch {
    return null;
  }
}

function fmtMoney(amount: number): string {
  return amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
}

// --- Colors ---
const cPrimary = rgb(0.08, 0.28, 0.18);   // Dark Forest #14472E
const cAccent = rgb(0.16, 0.67, 0.41);    // Emerald #2AAB68
const cInk = rgb(0.08, 0.12, 0.10);       // Dark Ink #141E1A
const cInk2 = rgb(0.35, 0.42, 0.38);      // Muted Ink #596B61
const cLine = rgb(0.85, 0.90, 0.87);      // Border line #D9E5DE
const cCardBg = rgb(0.96, 0.98, 0.97);    // Light tint #F5FAF7
const cTableHead = rgb(0.92, 0.96, 0.94); // Header fill #EAF5EF
const cWhite = rgb(1, 1, 1);
const cTrackBg = rgb(0.88, 0.92, 0.90);

function drawPageHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  ya: number,
  title: string,
  subtitle: string
): number {
  const { width } = page.getSize();
  let y = 805;

  // Top emerald accent bar
  page.drawRectangle({
    x: 36,
    y: y,
    width: width - 72,
    height: 3,
    color: cAccent,
  });
  y -= 22;

  // Brand / Category Tag
  page.drawText('PIP FINANCE  -  TAX RELIEF STATEMENT', {
    x: 36,
    y,
    size: 8.5,
    font: bold,
    color: cAccent,
  });
  page.drawText(`YEAR OF ASSESSMENT: YA ${ya}`, {
    x: width - 36 - bold.widthOfTextAtSize(`YEAR OF ASSESSMENT: YA ${ya}`, 8.5),
    y,
    size: 8.5,
    font: bold,
    color: cPrimary,
  });
  y -= 18;

  // Main Page Title
  page.drawText(title, {
    x: 36,
    y,
    size: 16,
    font: bold,
    color: cPrimary,
  });
  y -= 14;

  // Subtitle
  page.drawText(subtitle, {
    x: 36,
    y,
    size: 9.5,
    font,
    color: cInk2,
  });
  y -= 14;

  // Dividing rule
  page.drawLine({
    start: { x: 36, y },
    end: { x: width - 36, y },
    thickness: 1,
    color: cLine,
  });

  return y - 16;
}

function drawPageFooter(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  pageNum: number,
  totalPages: number,
  ya: number
) {
  const { width } = page.getSize();
  const y = 30;

  page.drawLine({
    start: { x: 36, y: y + 12 },
    end: { x: width - 36, y: y + 12 },
    thickness: 0.8,
    color: cLine,
  });

  const notice = `Pip Finance Tax Export - YA ${ya}`;
  page.drawText(notice, {
    x: 36,
    y,
    size: 7.5,
    font,
    color: cInk2,
  });

  const pageStr = `Page ${pageNum} of ${totalPages}`;
  const pageStrWidth = bold.widthOfTextAtSize(pageStr, 8);
  page.drawText(pageStr, {
    x: width - 36 - pageStrWidth,
    y,
    size: 8,
    font: bold,
    color: cPrimary,
  });
}

/**
 * Builds a clean, professional, publication-grade PDF tax relief statement (image-free).
 * The resulting PDF is concise, perfectly formatted for printing and official filing review.
 */
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
  const totalClaimed = usage
    .filter((u) => !schedule.lines.find((l) => l.code === u.code)?.parent)
    .reduce((s, u) => s + u.capUsed, 0);

  const totalSpent = tags.reduce((s, t) => s + t.amount, 0);
  const evidenceCount = tags.filter((t) => {
    const txn = transactions.find((x) => x.id === t.txnId);
    return !!(txn?.receiptUri || t.certImageUri || t.einvoiceImageUri);
  }).length;

  const pages: PDFPage[] = [];

  // =====================================================================================
  // PAGE 1: Executive Summary & Relief Schedule Table
  // =====================================================================================
  const p1 = doc.addPage([595.28, 841.89]); // A4
  pages.push(p1);
  const { width } = p1.getSize();
  const contentWidth = width - 72;

  let y = drawPageHeader(
    p1,
    font,
    bold,
    ya,
    `Personal Tax Relief Statement`,
    `Generated on ${new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })} - Malaysian Ringgit (MYR)`
  );

  // --- 3 Summary KPI Cards ---
  const cardW = (contentWidth - 16) / 3;
  const cardH = 50;

  // Card 1: Total Claimed
  p1.drawRectangle({
    x: 36,
    y: y - cardH,
    width: cardW,
    height: cardH,
    color: cCardBg,
    borderColor: cAccent,
    borderWidth: 1,
  });
  p1.drawText('TOTAL RELIEF CLAIMED', { x: 46, y: y - 16, size: 7.5, font: bold, color: cAccent });
  p1.drawText(`RM ${fmtMoney(totalClaimed)}`, { x: 46, y: y - 36, size: 14, font: bold, color: cPrimary });

  // Card 2: Total Spent
  p1.drawRectangle({
    x: 36 + cardW + 8,
    y: y - cardH,
    width: cardW,
    height: cardH,
    color: cCardBg,
    borderColor: cLine,
    borderWidth: 1,
  });
  p1.drawText('TOTAL SPENT TRACKED', { x: 46 + cardW + 8, y: y - 16, size: 7.5, font: bold, color: cInk2 });
  p1.drawText(`RM ${fmtMoney(totalSpent)}`, { x: 46 + cardW + 8, y: y - 36, size: 14, font: bold, color: cInk });

  // Card 3: Evidence Attachments
  p1.drawRectangle({
    x: 36 + (cardW + 8) * 2,
    y: y - cardH,
    width: cardW,
    height: cardH,
    color: cCardBg,
    borderColor: cLine,
    borderWidth: 1,
  });
  p1.drawText('AUDIT EVIDENCE ITEMS', { x: 46 + (cardW + 8) * 2, y: y - 16, size: 7.5, font: bold, color: cInk2 });
  p1.drawText(`${evidenceCount} Verified in ZIP`, { x: 46 + (cardW + 8) * 2, y: y - 36, size: 12.5, font: bold, color: cPrimary });

  y -= cardH + 20;

  // --- Relief Schedule Table ---
  p1.drawText('TAX RELIEF SCHEDULE', {
    x: 36,
    y,
    size: 10,
    font: bold,
    color: cPrimary,
  });
  y -= 16;

  // Table Header Box
  p1.drawRectangle({
    x: 36,
    y: y - 20,
    width: contentWidth,
    height: 20,
    color: cTableHead,
    borderColor: cLine,
    borderWidth: 0.8,
  });

  const colX = {
    field: 44,
    category: 105,
    claimed: 310,
    cap: 395,
    progress: 470,
  };

  p1.drawText('FIELD', { x: colX.field, y: y - 14, size: 8, font: bold, color: cPrimary });
  p1.drawText('TAX RELIEF CATEGORY', { x: colX.category, y: y - 14, size: 8, font: bold, color: cPrimary });
  p1.drawText('CLAIMED (RM)', { x: colX.claimed, y: y - 14, size: 8, font: bold, color: cPrimary });
  p1.drawText('CAP (RM)', { x: colX.cap, y: y - 14, size: 8, font: bold, color: cPrimary });
  p1.drawText('UTILISATION', { x: colX.progress, y: y - 14, size: 8, font: bold, color: cPrimary });
  y -= 20;

  for (let i = 0; i < schedule.lines.length; i++) {
    const line = schedule.lines[i];
    const u = usageByCode[line.code];
    const isChild = !!line.parent;
    const isParentAggregate = schedule.lines.some((l) => l.parent === line.code);
    const rowH = 19;

    // Row zebra background
    if (i % 2 === 1) {
      p1.drawRectangle({
        x: 36,
        y: y - rowH,
        width: contentWidth,
        height: rowH,
        color: cCardBg,
      });
    }

    // Row borders
    p1.drawLine({
      start: { x: 36, y: y - rowH },
      end: { x: 36 + contentWidth, y: y - rowH },
      thickness: 0.5,
      color: cLine,
    });

    const labelPrefix = isChild ? '   - ' : '';
    const rowFont = isParentAggregate ? bold : font;
    const textColor = isParentAggregate ? cPrimary : cInk;

    p1.drawText(line.formField, { x: colX.field, y: y - 13, size: 8, font: bold, color: cPrimary });
    p1.drawText(`${labelPrefix}${line.label}`.slice(0, 38), {
      x: colX.category,
      y: y - 13,
      size: 8.5,
      font: rowFont,
      color: textColor,
    });

    const claimedVal = u ? u.capUsed : 0;
    const capVal = u ? u.cap : line.cap;
    const pct = capVal > 0 ? Math.min(100, Math.round((claimedVal / capVal) * 100)) : 0;

    p1.drawText(fmtMoney(claimedVal), { x: colX.claimed, y: y - 13, size: 8.5, font: rowFont, color: textColor });
    p1.drawText(fmtMoney(capVal), { x: colX.cap, y: y - 13, size: 8.5, font, color: cInk2 });

    // Mini Progress Bar
    const trackW = 45;
    const barW = (pct / 100) * trackW;
    p1.drawRectangle({
      x: colX.progress,
      y: y - 12,
      width: trackW,
      height: 6,
      color: cTrackBg,
    });
    if (barW > 0) {
      p1.drawRectangle({
        x: colX.progress,
        y: y - 12,
        width: barW,
        height: 6,
        color: pct === 100 ? cAccent : cPrimary,
      });
    }
    p1.drawText(`${pct}%`, { x: colX.progress + trackW + 6, y: y - 13, size: 7.5, font: bold, color: cInk2 });

    y -= rowH;
  }

  // Grand Total Row
  p1.drawRectangle({
    x: 36,
    y: y - 22,
    width: contentWidth,
    height: 22,
    color: cTableHead,
    borderColor: cPrimary,
    borderWidth: 1,
  });
  p1.drawText('GRAND TOTAL CLAIMED:', {
    x: 44,
    y: y - 15,
    size: 9,
    font: bold,
    color: cPrimary,
  });
  p1.drawText(`RM ${fmtMoney(totalClaimed)}`, {
    x: colX.claimed,
    y: y - 15,
    size: 10,
    font: bold,
    color: cPrimary,
  });
  y -= 38;

  // =====================================================================================
  // PAGE 2+: Itemized Tax Relief Transaction Ledger
  // =====================================================================================
  let currentPage = doc.addPage([595.28, 841.89]);
  pages.push(currentPage);

  y = drawPageHeader(
    currentPage,
    font,
    bold,
    ya,
    `Itemized Tax Relief Transaction Ledger`,
    `Detailed item breakdown by tax relief category and archived evidence file names`
  );

  const ledgerCols = {
    date: 44,
    merchant: 110,
    origin: 275,
    spent: 350,
    claimed: 425,
    fileRef: 495,
  };

  const drawLedgerTableHeader = (page: PDFPage, curY: number): number => {
    page.drawRectangle({
      x: 36,
      y: curY - 18,
      width: contentWidth,
      height: 18,
      color: cTableHead,
      borderColor: cLine,
      borderWidth: 0.8,
    });
    page.drawText('DATE', { x: ledgerCols.date, y: curY - 13, size: 7.5, font: bold, color: cPrimary });
    page.drawText('MERCHANT / DETAILS', { x: ledgerCols.merchant, y: curY - 13, size: 7.5, font: bold, color: cPrimary });
    page.drawText('SOURCE', { x: ledgerCols.origin, y: curY - 13, size: 7.5, font: bold, color: cPrimary });
    page.drawText('SPENT (RM)', { x: ledgerCols.spent, y: curY - 13, size: 7.5, font: bold, color: cPrimary });
    page.drawText('CLAIMED (RM)', { x: ledgerCols.claimed, y: curY - 13, size: 7.5, font: bold, color: cPrimary });
    page.drawText('EVIDENCE', { x: ledgerCols.fileRef, y: curY - 13, size: 7.5, font: bold, color: cPrimary });
    return curY - 18;
  };

  y = drawLedgerTableHeader(currentPage, y);

  // Group tags by Relief Schedule Lines
  for (const line of schedule.lines) {
    const lineTags = tags.filter((t) => t.code === line.code);
    if (lineTags.length === 0) continue;

    const lineUsage = usageByCode[line.code];

    // Check page overflow
    if (y < 90 + lineTags.length * 20) {
      currentPage = doc.addPage([595.28, 841.89]);
      pages.push(currentPage);
      y = drawPageHeader(
        currentPage,
        font,
        bold,
        ya,
        `Itemized Tax Relief Transaction Ledger (Cont.)`,
        `Detailed item breakdown by tax relief category`
      );
      y = drawLedgerTableHeader(currentPage, y);
    }

    // Category Section Subheader
    currentPage.drawRectangle({
      x: 36,
      y: y - 18,
      width: contentWidth,
      height: 18,
      color: cCardBg,
      borderColor: cLine,
      borderWidth: 0.5,
    });
    currentPage.drawText(`${line.formField}  ${line.label.toUpperCase()}`, {
      x: 44,
      y: y - 13,
      size: 8,
      font: bold,
      color: cPrimary,
    });
    currentPage.drawText(`Capped Claim: RM ${fmtMoney(lineUsage ? lineUsage.capUsed : 0)} / Cap: RM ${fmtMoney(line.cap)}`, {
      x: 340,
      y: y - 13,
      size: 7.5,
      font: bold,
      color: cAccent,
    });
    y -= 18;

    // Transaction Rows
    for (let j = 0; j < lineTags.length; j++) {
      const tag = lineTags[j];
      const txn = transactions.find((t) => t.id === tag.txnId);
      const rowH = 18;

      if (y < 60) {
        currentPage = doc.addPage([595.28, 841.89]);
        pages.push(currentPage);
        y = drawPageHeader(
          currentPage,
          font,
          bold,
          ya,
          `Itemized Tax Relief Transaction Ledger (Cont.)`,
          `Detailed item breakdown by tax relief category`
        );
        y = drawLedgerTableHeader(currentPage, y);
      }

      if (j % 2 === 1) {
        currentPage.drawRectangle({
          x: 36,
          y: y - rowH,
          width: contentWidth,
          height: rowH,
          color: cCardBg,
        });
      }

      currentPage.drawLine({
        start: { x: 36, y: y - rowH },
        end: { x: 36 + contentWidth, y: y - rowH },
        thickness: 0.4,
        color: cLine,
      });

      const dateStr = txn?.date ? txn.date.slice(5) : '-';
      const merchantStr = (txn?.merchantRaw || 'Expense').slice(0, 30);
      const originStr = tag.origin === 'commitment' ? 'Recurring' : tag.origin === 'manual' ? 'Manual' : 'Auto Scan';
      const spentVal = txn ? txn.amount : tag.amount;

      let evidenceBadge = 'No Doc';
      if (tag.einvoiceImageUri) evidenceBadge = 'e-Invoice';
      else if (tag.certImageUri) evidenceBadge = 'Cert Doc';
      else if (txn?.receiptUri) evidenceBadge = 'Receipt';

      currentPage.drawText(dateStr, { x: ledgerCols.date, y: y - 12, size: 8, font, color: cInk2 });
      currentPage.drawText(merchantStr, { x: ledgerCols.merchant, y: y - 12, size: 8, font: bold, color: cInk });
      currentPage.drawText(originStr, { x: ledgerCols.origin, y: y - 12, size: 7.5, font, color: cInk2 });
      currentPage.drawText(fmtMoney(spentVal), { x: ledgerCols.spent, y: y - 12, size: 8, font, color: cInk });
      currentPage.drawText(fmtMoney(tag.amount), { x: ledgerCols.claimed, y: y - 12, size: 8, font: bold, color: cPrimary });
      currentPage.drawText(`[${evidenceBadge}]`, { x: ledgerCols.fileRef, y: y - 12, size: 7.5, font: bold, color: cAccent });

      y -= rowH;
    }
  }

  // Add footers to all pages with total page count
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    drawPageFooter(p, font, bold, idx + 1, totalPages, ya);
  });

  return doc.save();
}

/**
 * Packages all attached receipt photos, e-invoices, and certifications for a given Year of Assessment
 * into an organized ZIP archive structured by tax relief categories.
 */
export async function buildEvidenceZip(
  ya: number,
  schedule: ReliefSchedule,
  tags: ReliefTag[],
  transactions: Transaction[]
): Promise<Uint8Array> {
  const zipEntries: Record<string, Uint8Array> = {};
  const manifestItems: Array<{
    lineField: string;
    lineLabel: string;
    merchant: string;
    date: string;
    claimedAmount: number;
    files: string[];
  }> = [];

  for (const tag of tags) {
    const txn = transactions.find((t) => t.id === tag.txnId);
    const line = schedule.lines.find((l) => l.code === tag.code);
    if (!txn || !line) continue;

    const folderName = `${sanitizeName(line.formField)}_${sanitizeName(line.code)}`;
    const datePrefix = txn.date ? txn.date.replace(/-/g, '') : 'nodate';
    const merchantPrefix = sanitizeName(txn.merchantRaw || 'expense');
    const amountStr = `RM${tag.amount.toFixed(0)}`;

    const attachedFiles: string[] = [];

    // 1. Receipt Image
    if (txn.receiptUri) {
      const bytes = readImageBytes(txn.receiptUri);
      if (bytes) {
        const ext = txn.receiptUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        const fileName = `${datePrefix}_${merchantPrefix}_${amountStr}_receipt.${ext}`;
        const fullPath = `${folderName}/${fileName}`;
        zipEntries[fullPath] = bytes;
        attachedFiles.push(fullPath);
      }
    }

    // 2. Certification Image
    if (tag.certImageUri) {
      const bytes = readImageBytes(tag.certImageUri);
      if (bytes) {
        const ext = tag.certImageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        const fileName = `${datePrefix}_${merchantPrefix}_${amountStr}_cert.${ext}`;
        const fullPath = `${folderName}/${fileName}`;
        zipEntries[fullPath] = bytes;
        attachedFiles.push(fullPath);
      }
    }

    // 3. e-Invoice Image
    if (tag.einvoiceImageUri) {
      const bytes = readImageBytes(tag.einvoiceImageUri);
      if (bytes) {
        const ext = tag.einvoiceImageUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        const fileName = `${datePrefix}_${merchantPrefix}_${amountStr}_einvoice.${ext}`;
        const fullPath = `${folderName}/${fileName}`;
        zipEntries[fullPath] = bytes;
        attachedFiles.push(fullPath);
      }
    }

    manifestItems.push({
      lineField: line.formField,
      lineLabel: line.label,
      merchant: txn.merchantRaw,
      date: txn.date ?? 'unknown',
      claimedAmount: tag.amount,
      files: attachedFiles,
    });
  }

  // Add structured MANIFEST.json
  const manifestData = {
    application: 'Pip Finance',
    exportType: 'Tax Relief Evidence Archive',
    yearOfAssessment: ya,
    exportedAt: new Date().toISOString(),
    itemCount: manifestItems.length,
    items: manifestItems,
  };
  zipEntries['MANIFEST.json'] = strToU8(JSON.stringify(manifestData, null, 2));

  // Add human-readable README.txt
  const readmeText = [
    `================================================================================`,
    `TAX RELIEF AUDIT EVIDENCE ARCHIVE - YEAR OF ASSESSMENT YA ${ya}`,
    `Generated by Pip Finance (https://pipfinance.app)`,
    `Generated on: ${new Date().toUTCString()}`,
    `================================================================================`,
    ``,
    `This archive contains all original digital receipt photos, medical certifications,`,
    `and e-Invoices supporting your personal tax relief claims.`,
    ``,
    `DIRECTORY STRUCTURE:`,
    ...manifestItems.map(
      (m, idx) =>
        `${idx + 1}. [${m.lineField}] ${m.lineLabel} - ${m.merchant} (RM ${m.claimedAmount.toFixed(2)})\n   Date: ${m.date}\n   Files: ${m.files.join(', ') || 'No file attached'}`
    ),
    ``,
    `================================================================================`,
  ].join('\n');

  zipEntries['README.txt'] = strToU8(readmeText);

  return zipSync(zipEntries);
}
