// __tests__/calcKeypad.test.ts
import { applyCalcKey, formatBankingInput, type CalcKey } from '../src/lib/calcKeypad';
import { evaluateExpression } from '../src/lib/calc';

/** Type a whole sequence of keys, so tests read like what the user's thumb did. */
function type(keys: (CalcKey | string)[], decimals = 2, start = ''): string {
  return keys.reduce<string>((acc, k) => applyCalcKey(acc, k as CalcKey, decimals), start);
}

describe('calc keypad (banking style)', () => {
  describe('digits', () => {
    it('directly types 190 to yield 1.90 without needing decimal point', () => {
      expect(type(['1', '9', '0'])).toBe('1.90');
    });

    it('shifts in cents: 1 -> 0.01, 19 -> 0.19, 190 -> 1.90', () => {
      expect(type(['1'])).toBe('0.01');
      expect(type(['1', '9'])).toBe('0.19');
      expect(type(['1', '9', '0'])).toBe('1.90');
      expect(type(['1', '9', '0', '5'])).toBe('19.05');
    });

    it('ignores leading zeros when empty', () => {
      expect(type(['0'])).toBe('');
      expect(type(['0', '0'])).toBe('');
      expect(type(['0', '5'])).toBe('0.05');
    });

    it('formats whole amounts correctly: 500 -> 5.00', () => {
      expect(type(['5', '0', '0'])).toBe('5.00');
    });
  });

  describe('00 key', () => {
    it('ignores 00 when empty', () => {
      expect(type(['00'])).toBe('');
    });

    it('appends two zeros to quickly input whole currency amounts', () => {
      expect(type(['5', '00'])).toBe('5.00');
      expect(type(['1', '0', '00'])).toBe('10.00');
      expect(type(['5', '0', '00'])).toBe('50.00');
    });
  });

  describe('decimal point', () => {
    it('safely ignores decimal point key in banking mode', () => {
      expect(type(['1', '.', '9', '0'])).toBe('1.90');
      expect(type(['.'])).toBe('');
    });
  });

  describe('different currency decimals', () => {
    it('formats zero-decimal currencies (JPY, IDR) as whole integers', () => {
      expect(type(['1', '9', '0'], 0)).toBe('190');
      expect(type(['5', '00'], 0)).toBe('500');
      expect(type(['0'], 0)).toBe('');
    });

    it('formats 3-decimal currencies (KWD)', () => {
      expect(type(['1'], 3)).toBe('0.001');
      expect(type(['1', '9'], 3)).toBe('0.019');
      expect(type(['1', '9', '0'], 3)).toBe('0.190');
      expect(type(['1', '9', '0', '5'], 3)).toBe('1.905');
    });
  });

  describe('edits', () => {
    it('backspace shifts digits back out', () => {
      expect(type(['1', '9', '0', 'backspace'])).toBe('0.19');
      expect(type(['1', '9', '0', 'backspace', 'backspace'])).toBe('0.01');
      expect(type(['1', '9', '0', 'backspace', 'backspace', 'backspace'])).toBe('');
    });

    it('backspace on empty stays empty', () => {
      expect(type(['backspace'])).toBe('');
    });

    it('clear empties the whole expression', () => {
      expect(type(['1', '9', '0', '+', '8', '0', '0', 'clear'])).toBe('');
    });
  });

  describe('operators and expressions', () => {
    it('ignores an operator with no left-hand side', () => {
      expect(type(['+'])).toBe('');
      expect(type(['-'])).toBe('');
    });

    it('appends an operator after a valid number', () => {
      expect(type(['1', '9', '0', '+'])).toBe('1.90+');
    });

    it('replaces a trailing operator when the user changes their mind', () => {
      expect(type(['1', '9', '0', '+', '*'])).toBe('1.90*');
    });

    it('allows typing a second operand with banking digit shifting', () => {
      const text = type(['1', '9', '0', '+', '2', '5', '0']);
      expect(text).toBe('1.90+2.50');
      expect(evaluateExpression(text, 2).result).toBe(4.4);
      expect(evaluateExpression(text, 2).formatted).toBe('4.40');
    });

    it('backspaces across operands and operators', () => {
      expect(type(['1', '9', '0', '+', '2', '5', '0', 'backspace'])).toBe('1.90+0.25');
      expect(type(['1', '9', '0', '+', '2', '5', '0', 'backspace', 'backspace'])).toBe('1.90+0.02');
      expect(type(['1', '9', '0', '+', '2', '5', '0', 'backspace', 'backspace', 'backspace'])).toBe('1.90+');
      expect(type(['1', '9', '0', '+', '2', '5', '0', 'backspace', 'backspace', 'backspace', 'backspace'])).toBe('1.90');
      expect(type(['1', '9', '0', '+', '2', '5', '0', 'backspace', 'backspace', 'backspace', 'backspace', 'backspace'])).toBe('0.19');
    });
  });

  describe('formatBankingInput', () => {
    it('formats raw digit strings to banking currency format', () => {
      expect(formatBankingInput('190', 2)).toBe('1.90');
      expect(formatBankingInput('1.90', 2)).toBe('1.90');
      expect(formatBankingInput('500', 2)).toBe('5.00');
      expect(formatBankingInput('190', 0)).toBe('190');
    });

    it('formats multi-operand expressions', () => {
      expect(formatBankingInput('1.90+250', 2)).toBe('1.90+2.50');
      expect(formatBankingInput('190*300', 2)).toBe('1.90*3.00');
    });
  });
});

