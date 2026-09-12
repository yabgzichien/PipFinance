// src/lib/calcKeypad.ts
// Key handling for the on-screen amount keypad (components/AmountSheet.tsx).
// Follows the standard banking/e-wallet app pattern (e.g. Touch 'n Go, MAE):
// Users type digits without needing a decimal point (e.g. typing 190 yields 1.90).
//
// Deliberately a pure string->string reducer rather than logic inside the sheet: the keypad
// produces an expression text that lib/calc.ts (evaluateExpression) consumes unchanged.
// Keeping it pure also ensures edge cases — leading zeros, 00 key, operators, backspacing
// across decimals and operators — are thoroughly unit-testable.

const OPERATORS = new Set(['+', '-', '*', '/']);

/** Maximum number of raw digits per number segment to prevent overflow. */
const MAX_DIGITS = 10;

/** Everything the pad can emit. Digits and operators land in the expression; the last two
 *  are edits rather than input. */
export type CalcKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '00' | '.' | '+' | '-' | '*' | '/'
  | 'backspace'
  | 'clear';

/**
 * The digits/characters since the last operator — i.e. the number currently being typed.
 */
export function currentSegment(text: string): string {
  let i = text.length;
  while (i > 0 && !OPERATORS.has(text[i - 1])) i--;
  return text.slice(i);
}

/**
 * Format a string of raw digits into a banking/currency amount.
 * E.g. with decimals = 2:
 *  "1" -> "0.01"
 *  "19" -> "0.19"
 *  "190" -> "1.90"
 *  "1905" -> "19.05"
 *
 * For decimals = 0:
 *  "190" -> "190"
 */
export function formatSegment(digits: string, decimals: number = 2): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+/, '');
  if (!clean) return '';
  if (decimals <= 0) return clean;

  if (clean.length <= decimals) {
    const padded = clean.padStart(decimals + 1, '0');
    return `${padded.slice(0, padded.length - decimals)}.${padded.slice(padded.length - decimals)}`;
  }
  return `${clean.slice(0, clean.length - decimals)}.${clean.slice(clean.length - decimals)}`;
}

/**
 * Apply one keypress to the current expression text.
 *
 * @param text     the expression so far, e.g. "12.50+8.00"
 * @param key      the key pressed
 * @param decimals how many fractional digits this currency allows. 0 (JPY, IDR) disables the
 *                 fractional digits entirely.
 */
export function applyCalcKey(text: string, key: CalcKey, decimals: number = 2): string {
  if (key === 'clear') return '';

  const seg = currentSegment(text);
  const prefix = text.slice(0, text.length - seg.length);

  if (key === 'backspace') {
    if (text.length === 0) return '';
    // If the current segment is empty, we are sitting right after an operator (e.g. "1.90+").
    // Deleting removes the operator.
    if (seg.length === 0) {
      return text.slice(0, -1);
    }
    const digits = seg.replace(/\D/g, '').replace(/^0+/, '');
    const nextDigits = digits.slice(0, -1);
    const nextFormatted = formatSegment(nextDigits, decimals);
    return prefix + nextFormatted;
  }

  if (OPERATORS.has(key)) {
    // An operator needs a left-hand side. Ignoring it (rather than starting the expression
    // with one) keeps the live preview from flickering through an invalid state.
    if (text.length === 0) return text;
    // Typing a second operator means the user changed their mind about the first.
    if (seg.length === 0) {
      return text.slice(0, -1) + key;
    }
    const digits = seg.replace(/\D/g, '').replace(/^0+/, '');
    if (!digits) return text;
    return text + key;
  }

  // Decimal point is not needed in banking mode (digits shift in from cents).
  // If pressed (e.g. on a hardware keyboard), treat it safely as a no-op.
  if (key === '.') {
    return text;
  }

  if (key === '00') {
    const digits = seg.replace(/\D/g, '').replace(/^0+/, '');
    if (!digits) return text;
    if (digits.length + 2 > MAX_DIGITS) return text;
    const nextDigits = digits + '00';
    return prefix + formatSegment(nextDigits, decimals);
  }

  if (/^[0-9]$/.test(key)) {
    const digits = seg.replace(/\D/g, '').replace(/^0+/, '');
    // A bare leading zero when empty does not stack.
    if (key === '0' && !digits) return text;
    if (digits.length + 1 > MAX_DIGITS) return text;
    const nextDigits = digits + key;
    return prefix + formatSegment(nextDigits, decimals);
  }

  return text;
}

/**
 * Formats a full input string into banking app currency format.
 * Normalizes math operators and formats each operand segment.
 */
export function formatBankingInput(input: string, decimals: number = 2): string {
  // Normalize alternative multiplication and division characters
  let cleaned = input
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷\\]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/([0-9\)])\s*[xX]\s*([0-9\(\.])/g, '$1*$2');

  // Keep only digits and operators
  cleaned = cleaned.replace(/[^0-9\+\-\*\/]/g, '');

  let result = '';
  let currentDigits = '';

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (OPERATORS.has(ch)) {
      if (currentDigits) {
        result += formatSegment(currentDigits, decimals);
        currentDigits = '';
      }
      if (result.length > 0) {
        if (OPERATORS.has(result[result.length - 1])) {
          result = result.slice(0, -1) + ch;
        } else {
          result += ch;
        }
      }
    } else if (/[0-9]/.test(ch)) {
      if (currentDigits.length < MAX_DIGITS) {
        currentDigits += ch;
      }
    }
  }

  if (currentDigits) {
    result += formatSegment(currentDigits, decimals);
  }

  return result;
}
