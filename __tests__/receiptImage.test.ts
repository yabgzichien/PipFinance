// __tests__/receiptImage.test.ts
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
  saveReceiptPng,
} from '../src/lib/receiptImage';
import * as fs from 'fs';

describe('receiptImage', () => {
  describe('base64 and byte conversions', () => {
    it('converts base64 to Uint8Array and back cleanly', () => {
      const originalText = 'PipFinanceReceiptTest123';
      const base64 = Buffer.from(originalText).toString('base64');

      const bytes = base64ToUint8Array(base64);
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(originalText.length);

      const reconstructedBase64 = uint8ArrayToBase64(bytes);
      expect(reconstructedBase64).toBe(base64);
      expect(Buffer.from(reconstructedBase64, 'base64').toString('utf8')).toBe(originalText);
    });

    it('handles data URL prefixes correctly', () => {
      const original = 'HelloPngData';
      const rawBase64 = Buffer.from(original).toString('base64');
      const dataUrl = `data:image/png;base64,${rawBase64}`;

      const bytes = base64ToUint8Array(dataUrl);
      expect(Buffer.from(bytes).toString('utf8')).toBe(original);
    });
  });

  describe('saveReceiptPng', () => {
    it('saves bytes to file and returns file URI', () => {
      const dummyPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
      const uri = saveReceiptPng(dummyPngBytes, 'test-share-123');

      expect(uri).toBeTruthy();
      expect(uri).toContain('pip_receipt_test-share-123_');
      expect(uri).toMatch(/\.png$/);

      const localPath = uri.replace(/^file:\/\//, '');
      expect(fs.existsSync(localPath)).toBe(true);

      // Clean up
      try {
        fs.unlinkSync(localPath);
      } catch {}
    });
  });
});
