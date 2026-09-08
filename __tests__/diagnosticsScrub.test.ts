// __tests__/diagnosticsScrub.test.ts
import { handledErrorName, redactFatalMessage, sanitizeStack } from '../src/lib/diagnosticsScrub';

describe('redactFatalMessage', () => {
  it('keeps the property path in a Hermes type error', () => {
    expect(redactFatalMessage("undefined is not an object (evaluating 'txn.merchant.name')")).toBe(
      "undefined is not an object (evaluating 'txn.merchant.name')"
    );
  });

  it('redacts a quoted merchant name', () => {
    expect(redactFatalMessage('Cannot parse "STARBUCKS KLCC RM23.50"')).toBe('Cannot parse "<str>"');
  });

  it('redacts a bare decimal amount', () => {
    expect(redactFatalMessage('Balance 1284.75 exceeds cap')).toBe('Balance <num> exceeds cap');
  });

  it('keeps a small integer that reads as an index', () => {
    expect(redactFatalMessage('index 3 out of range')).toBe('index 3 out of range');
  });
});

describe('sanitizeStack', () => {
  const stack = [
    'TypeError: Cannot parse "STARBUCKS KLCC RM23.50"',
    '    at parseReceipt (src/lib/parseReceipt.ts:142:9)',
    '    at processLine (src/lib/receiptOcr.ts:88:5)',
  ].join('\n');

  it('drops the message line so no user data rides along with the frames', () => {
    expect(sanitizeStack(stack)).toBe(
      '    at parseReceipt (src/lib/parseReceipt.ts:142:9)\n    at processLine (src/lib/receiptOcr.ts:88:5)'
    );
  });

  it('drops a multi-line message entirely', () => {
    const wrapped = ['Error: line one', 'RM23.50 spent at STARBUCKS', '    at f (src/lib/a.ts:1:1)'].join('\n');
    expect(sanitizeStack(wrapped)).toBe('    at f (src/lib/a.ts:1:1)');
  });

  it('returns undefined when there is no stack at all', () => {
    expect(sanitizeStack(undefined)).toBeUndefined();
  });

  it('returns undefined rather than a bare message when no frames were captured', () => {
    expect(sanitizeStack('TypeError: boom')).toBeUndefined();
  });
});

describe('handledErrorName', () => {
  it('names the error class', () => {
    expect(handledErrorName(new TypeError('Cannot parse STARBUCKS KLCC'))).toBe('TypeError');
  });

  it('reports a thrown non-error without echoing its value', () => {
    expect(handledErrorName('STARBUCKS KLCC RM23.50')).toBe('NonError');
  });
});
