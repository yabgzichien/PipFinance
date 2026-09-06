// src/lib/calcKeypad.ts
// Key handling for the on-screen amount keypad (components/AmountSheet.tsx).
//
// Deliberately a pure string->string reducer rather than logic inside the sheet: the keypad
// produces exactly the same expression text the amount TextInput used to produce, so
// lib/calc.ts (evaluateExpression) consumes it unchanged. Keeping it pure also means the
// fiddly cases below — leading zeros, a dot with no integer part, an operator typed twice —
// are unit-testable without rendering a modal.

const OPERATORS = new Set(['+', '-', '*', '/']);

/** Everything the pad can emit. Digits and operators land in the expression; the last two
 *  are edits rather than input. */
export type CalcKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.' | '+' | '-' | '*' | '/'
  | 'backspace'
  | 'clear';

/**
 * The digits since the last operator — i.e. the number currently being typed. Decimal-point
 * and leading-zero rules apply to this segment only, never to the whole expression: in
 * "12+0", the "0" is its own number and "5" should replace it, but in "12+0.5" it must not.
 */
function currentSegment(text: string): string {
  let i = text.length;
  while (i > 0 && !OPERATORS.has(text[i - 1])) i--;
  return text.slice(i);
}

/**
 * Apply one keypress to the current expression text.
 *
 * @param text     the expression so far, e.g. "12+8"
 * @param key      the key pressed
 * @param decimals how many fractional digits this currency allows. 0 (JPY, IDR) disables the
 *                 decimal point entirely, mirroring `cleanCalcInput(t, decimals > 0)`.
 */
export function applyCalcKey(text: string, key: CalcKey, decimals: number = 2): string {
  if (key === 'clear') return '';
  if (key === 'backspace') return text.slice(0, -1);

  if (OPERATORS.has(key)) {
    // An operator needs a left-hand side. Ignoring it (rather than starting the expression
    // with one) keeps the live preview from flickering through an invalid state.
    if (text.length === 0) return text;
    const last = text[text.length - 1];
    // Typing a second operator means the user changed their mind about the first, and a
    // dangling "12." is really just "12" — in both cases replace rather than append.
    if (OPERATORS.has(last) || last === '.') return text.slice(0, -1) + key;
    return text + key;
  }

  if (key === '.') {
    if (decimals <= 0) return text;
    const seg = currentSegment(text);
    if (seg.includes('.')) return text;
    // ".5" is ambiguous to read back; write it the way it will be saved.
    if (seg.length === 0) return text + '0.';
    return text + '.';
  }

  if (/^[0-9]$/.test(key)) {
    const seg = currentSegment(text);
    // A bare leading zero is a placeholder, not a value: "0" then "5" is 5, not 05.
    if (seg === '0') return text.slice(0, -1) + key;
    const dot = seg.indexOf('.');
    // Refuse fractional digits the currency cannot represent, so the pad can never build a
    // number that save() would silently round away.
    if (dot !== -1 && seg.length - dot - 1 >= decimals) return text;
    return text + key;
  }

  return text;
}
