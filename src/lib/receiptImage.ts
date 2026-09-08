// src/lib/receiptImage.ts
// Utility functions for decoding receipt PNG base64 data and writing receipt images
// to the cache directory via expo-file-system.
import { File, Paths } from 'expo-file-system';

/**
 * Converts a base64 string (with or without data URL prefix) into a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:image\/\w+;base64,/, '').trim();
  if (typeof atob !== 'undefined') {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  return new Uint8Array(0);
}

/**
 * Converts a Uint8Array into a base64 string.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'undefined') {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  return '';
}

/**
 * Saves a PNG receipt byte array to the application cache directory.
 * Returns the file URI (e.g. `file:///data/.../cache/pip_receipt_123.png`).
 */
export function saveReceiptPng(bytes: Uint8Array, key: string): string {
  const fileName = `pip_receipt_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.png`;

  try {
    const file = new File(Paths.cache, fileName);
    file.write(bytes);
    return file.uri;
  } catch {
    // Resilient fallback for Jest test / headless / node environments
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const outPath = path.join(os.tmpdir(), fileName);
      fs.writeFileSync(outPath, Buffer.from(bytes));
      return `file://${outPath}`;
    } catch {
      return '';
    }
  }
}
