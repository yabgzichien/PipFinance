// __tests__/calc.test.ts
import { evaluateExpression, cleanCalcInput, isMathExpression } from '../src/lib/calc';

describe('Math Calculation Engine', () => {
  describe('Basic arithmetic', () => {
    it('evaluates simple addition', () => {
      const res = evaluateExpression('3.1+3+1');
      expect(res.isValid).toBe(true);
      expect(res.isExpression).toBe(true);
      expect(res.result).toBe(7.1);
      expect(res.formatted).toBe('7.10');
    });

    it('evaluates user screenshot case: 3.1+3.2+21', () => {
      const res = evaluateExpression('3.1+3.2+21');
      expect(res.isValid).toBe(true);
      expect(res.isExpression).toBe(true);
      expect(res.result).toBe(27.3);
      expect(res.formatted).toBe('27.30');
    });

    it('evaluates subtraction', () => {
      const res = evaluateExpression('100 - 25.5');
      expect(res.isValid).toBe(true);
      expect(res.result).toBe(74.5);
    });

    it('evaluates multiplication', () => {
      const res = evaluateExpression('12.5 * 4');
      expect(res.isValid).toBe(true);
      expect(res.result).toBe(50);
    });

    it('evaluates alternative multiplication symbols (x, X, ×)', () => {
      expect(evaluateExpression('12.5 x 4').result).toBe(50);
      expect(evaluateExpression('12.5 X 4').result).toBe(50);
      expect(evaluateExpression('12.5 × 4').result).toBe(50);
    });

    it('evaluates division', () => {
      const res = evaluateExpression('100 / 4');
      expect(res.isValid).toBe(true);
      expect(res.result).toBe(25);
    });

    it('evaluates alternative division symbol (÷)', () => {
      expect(evaluateExpression('100 ÷ 4').result).toBe(25);
    });
  });

  describe('Operator precedence and grouping', () => {
    it('respects standard PEMDAS / BODMAS order of operations', () => {
      // 10 + (2 * 3) = 16, not (10 + 2) * 3 = 36
      expect(evaluateExpression('10 + 2 * 3').result).toBe(16);
      expect(evaluateExpression('100 - 25 * 2 / 5').result).toBe(90);
    });

    it('evaluates expressions with parentheses', () => {
      expect(evaluateExpression('(10 + 2) * 3').result).toBe(36);
      expect(evaluateExpression('(100 - 20) / (2 + 2)').result).toBe(20);
      expect(evaluateExpression('((5 + 5) * 2) + 10').result).toBe(30);
    });

    it('supports tax multiplier with decimal parentheses', () => {
      // (10 + 20 + 30) * 1.06 = 63.6
      expect(evaluateExpression('(10 + 20 + 30) * 1.06').result).toBe(63.6);
    });
  });

  describe('Percentage calculations', () => {
    it('evaluates percentage as factor', () => {
      expect(evaluateExpression('200 * 6%').result).toBe(12);
      expect(evaluateExpression('50 * 10%').result).toBe(5);
    });
  });

  describe('Live typing resilience (forgiving incomplete inputs)', () => {
    it('evaluates prefix when trailing operator is typed', () => {
      expect(evaluateExpression('3.1 +').result).toBe(3.1);
      expect(evaluateExpression('100 *').result).toBe(100);
      expect(evaluateExpression('50 -').result).toBe(50);
      expect(evaluateExpression('25 /').result).toBe(25);
    });

    it('auto-closes open parentheses during in-progress typing', () => {
      expect(evaluateExpression('(10 + 5').result).toBe(15);
      expect(evaluateExpression('((10 + 5) * 2').result).toBe(30);
    });

    it('handles trailing decimal points during in-progress typing', () => {
      expect(evaluateExpression('3.').result).toBe(3);
      expect(evaluateExpression('10 + 2.').result).toBe(12);
    });
  });

  describe('Edge cases and safety', () => {
    it('safely handles division by zero', () => {
      const res = evaluateExpression('100 / 0');
      expect(res.result).toBeNull();
      expect(res.isValid).toBe(false);
    });

    it('safely handles empty or whitespace input', () => {
      expect(evaluateExpression('').result).toBeNull();
      expect(evaluateExpression('   ').result).toBeNull();
    });

    it('safely handles invalid syntax', () => {
      expect(evaluateExpression('++').result).toBeNull();
      expect(evaluateExpression('* 5').result).toBeNull();
      expect(evaluateExpression('3.1.2 + 4').result).toBeNull();
    });

    it('handles plain numbers correctly', () => {
      const res = evaluateExpression('42.50');
      expect(res.result).toBe(42.5);
      expect(res.isExpression).toBe(false);
      expect(res.isValid).toBe(true);
    });

    it('identifies math expressions vs plain numbers', () => {
      expect(isMathExpression('12.50')).toBe(false);
      expect(isMathExpression('12.50+5')).toBe(true);
      expect(isMathExpression('10*2')).toBe(true);
      expect(isMathExpression('100/4')).toBe(true);
      expect(isMathExpression('(10)')).toBe(true);
    });
  });

  describe('cleanCalcInput', () => {
    it('strips non-math characters and normalizes symbols', () => {
      expect(cleanCalcInput('RM 3.1 + 3.2')).toBe('3.1 + 3.2');
      expect(cleanCalcInput('10 × 2 ÷ 4')).toBe('10 * 2 / 4');
      expect(cleanCalcInput('5x4')).toBe('5*4');
      expect(cleanCalcInput('abc12+34def')).toBe('12+34');
    });

    it('respects allowDecimals = false', () => {
      expect(cleanCalcInput('10.5 + 20.2', false)).toBe('105 + 202');
    });
  });
});
