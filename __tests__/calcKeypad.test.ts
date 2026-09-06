// __tests__/calcKeypad.test.ts
import { applyCalcKey, type CalcKey } from '../src/lib/calcKeypad';
import { evaluateExpression } from '../src/lib/calc';

/** Type a whole sequence of keys, so tests read like what the user's thumb did. */
function type(keys: (CalcKey | string)[], decimals = 2, start = ''): string {
  return keys.reduce<string>((acc, k) => applyCalcKey(acc, k as CalcKey, decimals), start);
}

describe('calc keypad', () => {
  describe('digits', () => {
    it('appends digits in order', () => {
      expect(type(['1', '2', '3'])).toBe('123');
    });

    it('replaces a bare leading zero rather than stacking onto it', () => {
      expect(type(['0', '5'])).toBe('5');
    });

    it('keeps a zero that is the integer part of a decimal', () => {
      expect(type(['0', '.', '5'])).toBe('0.5');
    });

    it('treats each operand separately, so a zero after an operator still collapses', () => {
      expect(type(['1', '2', '+', '0', '5'])).toBe('12+5');
    });
  });

  describe('decimal point', () => {
    it('writes a leading dot as 0.', () => {
      expect(type(['.', '5'])).toBe('0.5');
    });

    it('refuses a second dot in the same operand', () => {
      expect(type(['1', '.', '5', '.'])).toBe('1.5');
    });

    it('allows a dot in a later operand', () => {
      expect(type(['1', '.', '5', '+', '2', '.', '5'])).toBe('1.5+2.5');
    });

    it('is disabled entirely for zero-decimal currencies', () => {
      expect(type(['1', '.', '5'], 0)).toBe('15');
    });

    it('caps fractional digits at the currency precision', () => {
      expect(type(['1', '.', '2', '3', '4'])).toBe('1.23');
    });

    it('does not cap integer digits', () => {
      expect(type(['1', '2', '3', '4', '5', '6'])).toBe('123456');
    });
  });

  describe('operators', () => {
    it('ignores an operator with no left-hand side', () => {
      expect(type(['+'])).toBe('');
      expect(type(['-'])).toBe('');
    });

    it('appends an operator after a number', () => {
      expect(type(['1', '2', '+'])).toBe('12+');
    });

    it('replaces a trailing operator when the user changes their mind', () => {
      expect(type(['1', '2', '+', '*'])).toBe('12*');
    });

    it('replaces a dangling decimal point with the operator', () => {
      expect(type(['1', '2', '.', '+'])).toBe('12+');
    });
  });

  describe('edits', () => {
    it('backspace removes the last character', () => {
      expect(type(['1', '2', '3', 'backspace'])).toBe('12');
    });

    it('backspace on empty stays empty', () => {
      expect(type(['backspace'])).toBe('');
    });

    it('clear empties the whole expression', () => {
      expect(type(['1', '2', '+', '8', 'clear'])).toBe('');
    });
  });

  describe('hands off cleanly to the existing evaluator', () => {
    it('produces an expression lib/calc.ts evaluates to the expected total', () => {
      const text = type(['1', '2', '+', '8']);
      expect(text).toBe('12+8');
      expect(evaluateExpression(text, 2).result).toBe(20);
    });

    it('produces a plain number for a non-expression entry', () => {
      const text = type(['4', '2', '.', '5']);
      const res = evaluateExpression(text, 2);
      expect(res.isExpression).toBe(false);
      expect(res.result).toBe(42.5);
    });

    it('leaves a trailing operator that the live preview can still evaluate', () => {
      const text = type(['1', '2', '+']);
      expect(evaluateExpression(text, 2).result).toBe(12);
    });
  });
});
