// __tests__/seedTaxRelief.test.ts
import fs from 'fs';
import path from 'path';
import * as fflate from 'fflate';
import { RELIEF_SCHEDULE_2025 } from '../src/lib/reliefSchedule';
import { buildAuditPackPdf, buildEvidenceZip } from '../src/lib/taxExport';
import type { ReliefTag, Transaction } from '../src/lib/types';

const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACT_DIR = '/home/yang/.gemini/antigravity/brain/90c0aac5-f12e-4e17-9e55-669b9c3ba1cf';
const RECEIPTS_DIR = path.join(ROOT_DIR, 'assets/demo/receipts');

const rPopular = path.join(RECEIPTS_DIR, 'popular_bookstore_receipt.png');
const rMachines = path.join(RECEIPTS_DIR, 'machines_apple_invoice.png');
const rDecathlon = path.join(RECEIPTS_DIR, 'decathlon_sports_receipt.png');
const rAnytime = path.join(RECEIPTS_DIR, 'anytime_fitness_invoice.png');
const rDental = path.join(RECEIPTS_DIR, 'klinik_dental_cert.png');
const rGleneagles = path.join(RECEIPTS_DIR, 'gleneagles_checkup_receipt.png');
const rSspn = path.join(RECEIPTS_DIR, 'sspn_deposit_statement.png');
const rPrudential = path.join(RECEIPTS_DIR, 'prudential_insurance_statement.png');
const rChildcare = path.join(RECEIPTS_DIR, 'little_caliphs_childcare_receipt.png');

const seededTransactions: Transaction[] = [
  {
    id: 'txn_01_books',
    merchantRaw: 'Popular Bookstore',
    merchantKey: 'popularbookstore',
    amount: 250.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-03-15',
    categoryId: 'shopping',
    createdAt: '2025-03-15T10:30:00.000Z',
    source: 'extracted',
    receiptUri: rPopular,
  },
  {
    id: 'txn_02_ipad',
    merchantRaw: 'Apple Store (Machines)',
    merchantKey: 'applestore',
    amount: 2250.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-07-20',
    categoryId: 'shopping',
    createdAt: '2025-07-20T14:15:00.000Z',
    source: 'extracted',
    receiptUri: rMachines,
  },
  {
    id: 'txn_03_decathlon',
    merchantRaw: 'Decathlon Malaysia',
    merchantKey: 'decathlon',
    amount: 450.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-04-10',
    categoryId: 'shopping',
    createdAt: '2025-04-10T11:00:00.000Z',
    source: 'extracted',
    receiptUri: rDecathlon,
  },
  {
    id: 'txn_04_gym',
    merchantRaw: 'Anytime Fitness',
    merchantKey: 'anytimefitness',
    amount: 550.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-06-01',
    categoryId: 'subscriptions',
    createdAt: '2025-06-01T09:00:00.000Z',
    source: 'extracted',
    receiptUri: rAnytime,
  },
  {
    id: 'txn_05_dental',
    merchantRaw: 'Klinik Pergigian Dental Care',
    merchantKey: 'klinikpergigian',
    amount: 350.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-05-18',
    categoryId: 'health',
    createdAt: '2025-05-18T16:00:00.000Z',
    source: 'extracted',
    receiptUri: rDental,
  },
  {
    id: 'txn_06_checkup',
    merchantRaw: 'Gleneagles Medical Centre',
    merchantKey: 'gleneagles',
    amount: 650.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-08-12',
    categoryId: 'health',
    createdAt: '2025-08-12T10:00:00.000Z',
    source: 'extracted',
    receiptUri: rGleneagles,
  },
  {
    id: 'txn_07_sspn',
    merchantRaw: 'PTPTN SSPN-i Prime Deposit',
    merchantKey: 'ptptnsspn',
    amount: 6000.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-11-05',
    categoryId: 'savings',
    createdAt: '2025-11-05T15:20:00.000Z',
    source: 'extracted',
    receiptUri: rSspn,
  },
  {
    id: 'txn_08_insurance',
    merchantRaw: 'Prudential Takaful Medical Premium',
    merchantKey: 'prudentialtakaful',
    amount: 3600.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-01-15',
    categoryId: 'insurance',
    createdAt: '2025-01-15T08:30:00.000Z',
    source: 'extracted',
    receiptUri: rPrudential,
  },
  {
    id: 'txn_09_childcare',
    merchantRaw: 'Little Caliphs Kindergarten',
    merchantKey: 'littlecaliphs',
    amount: 2400.0,
    currency: 'MYR',
    type: 'expense',
    date: '2025-02-01',
    categoryId: 'education',
    createdAt: '2025-02-01T09:45:00.000Z',
    source: 'extracted',
    receiptUri: rChildcare,
  },
];

const seededTags: ReliefTag[] = [
  {
    id: 'rt_01',
    txnId: 'txn_01_books',
    code: 'lifestyle',
    ya: 2025,
    amount: 250.0,
    origin: 'auto',
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt: '2025-03-15T10:30:00.000Z',
  },
  {
    id: 'rt_02',
    txnId: 'txn_02_ipad',
    code: 'lifestyle',
    ya: 2025,
    amount: 2250.0,
    origin: 'auto',
    certImageUri: null,
    einvoiceImageUri: rMachines,
    createdAt: '2025-07-20T14:15:00.000Z',
  },
  {
    id: 'rt_03',
    txnId: 'txn_03_decathlon',
    code: 'sports',
    ya: 2025,
    amount: 450.0,
    origin: 'auto',
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt: '2025-04-10T11:00:00.000Z',
  },
  {
    id: 'rt_04',
    txnId: 'txn_04_gym',
    code: 'sports',
    ya: 2025,
    amount: 550.0,
    origin: 'auto',
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt: '2025-06-01T09:00:00.000Z',
  },
  {
    id: 'rt_05',
    txnId: 'txn_05_dental',
    code: 'medical.dental',
    ya: 2025,
    amount: 350.0,
    origin: 'manual',
    certImageUri: rDental,
    einvoiceImageUri: null,
    createdAt: '2025-05-18T16:00:00.000Z',
  },
  {
    id: 'rt_06',
    txnId: 'txn_06_checkup',
    code: 'medical.checkup',
    ya: 2025,
    amount: 650.0,
    origin: 'auto',
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt: '2025-08-12T10:00:00.000Z',
  },
  {
    id: 'rt_07',
    txnId: 'txn_07_sspn',
    code: 'sspn',
    ya: 2025,
    amount: 6000.0,
    origin: 'commitment',
    certImageUri: null,
    einvoiceImageUri: rSspn,
    createdAt: '2025-11-05T15:20:00.000Z',
  },
  {
    id: 'rt_08',
    txnId: 'txn_08_insurance',
    code: 'insurance.education-medical',
    ya: 2025,
    amount: 3600.0,
    origin: 'commitment',
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt: '2025-01-15T08:30:00.000Z',
  },
  {
    id: 'rt_09',
    txnId: 'txn_09_childcare',
    code: 'childcare',
    ya: 2025,
    amount: 2400.0,
    origin: 'auto',
    certImageUri: null,
    einvoiceImageUri: null,
    createdAt: '2025-02-01T09:45:00.000Z',
  },
];

describe('Seed Tax Relief, Clean PDF Export & Separate Evidence ZIP Export', () => {
  const ya = 2025;

  it('exports a clean, organized, image-free PDF tax statement', async () => {
    const pdfBytes = await buildAuditPackPdf(ya, RELIEF_SCHEDULE_2025, seededTags, seededTransactions);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    const localPdfPath = path.join(ROOT_DIR, `tax-relief-statement-${ya}.pdf`);
    fs.writeFileSync(localPdfPath, pdfBytes);
    expect(fs.existsSync(localPdfPath)).toBe(true);

    if (fs.existsSync(ARTIFACT_DIR)) {
      const artifactPdfPath = path.join(ARTIFACT_DIR, `tax-relief-statement-${ya}.pdf`);
      fs.writeFileSync(artifactPdfPath, pdfBytes);
      expect(fs.existsSync(artifactPdfPath)).toBe(true);
    }
  });

  it('exports all attached receipts and evidence into a structured ZIP archive', async () => {
    const zipBytes = await buildEvidenceZip(ya, RELIEF_SCHEDULE_2025, seededTags, seededTransactions);
    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(5000);

    const localZipPath = path.join(ROOT_DIR, `tax-relief-evidence-${ya}.zip`);
    fs.writeFileSync(localZipPath, zipBytes);
    expect(fs.existsSync(localZipPath)).toBe(true);

    if (fs.existsSync(ARTIFACT_DIR)) {
      const artifactZipPath = path.join(ARTIFACT_DIR, `tax-relief-evidence-${ya}.zip`);
      fs.writeFileSync(artifactZipPath, zipBytes);
      expect(fs.existsSync(artifactZipPath)).toBe(true);
    }

    // Verify ZIP contents with fflate
    const unzipped = fflate.unzipSync(zipBytes);
    const fileList = Object.keys(unzipped);

    expect(fileList).toContain('MANIFEST.json');
    expect(fileList).toContain('README.txt');

    // Verify category folders exist
    expect(fileList.some((f) => f.startsWith('G9_lifestyle/'))).toBe(true);
    expect(fileList.some((f) => f.startsWith('G10_sports/'))).toBe(true);
    expect(fileList.some((f) => f.startsWith('G6_iv_medical_dental/'))).toBe(true);
    expect(fileList.some((f) => f.startsWith('G7_medical_checkup/'))).toBe(true);
    expect(fileList.some((f) => f.startsWith('G13_sspn/'))).toBe(true);
    expect(fileList.some((f) => f.startsWith('G4_insurance_education_medical/'))).toBe(true);
    expect(fileList.some((f) => f.startsWith('G12_childcare/'))).toBe(true);

    // Verify manifest contents
    const manifestJson = JSON.parse(fflate.strFromU8(unzipped['MANIFEST.json']));
    expect(manifestJson.yearOfAssessment).toBe(2025);
    expect(manifestJson.items.length).toBe(9);
  });
});
