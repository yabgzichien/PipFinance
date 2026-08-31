// src/lib/calc.ts
// Deterministic math calculation engine for pip expense/income entry.
// Evaluates basic arithmetic (+, -, *, /, %, parentheses) without using eval().
import { round2 } from './currency';

export interface CalcResult {
  /** Evaluated numeric amount, or null if empty/invalid/division-by-zero */
  result: number | null;
  /** True if input contains operators (+, -, *, /, %, (, )), meaning it's an expression */
  isExpression: boolean;
  /** True if the expression was successfully evaluated */
  isValid: boolean;
  /** Formatted string with given or standard decimal places (e.g. "27.30") */
  formatted: string | null;
}

type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'PERCENT' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value?: number;
}

/**
 * Sanitize text typed into an amount calculation field.
 * Allows digits, decimal dot, math operators (+, -, *, /, x, X, ×, ÷, %, (, )), and spaces.
 */
export function cleanCalcInput(input: string, allowDecimals: boolean = true): string {
  // Normalize alternative multiplication and division characters
  let cleaned = input
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷\\]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/([0-9\)])\s*[xX]\s*([0-9\(\.])/g, '$1*$2'); // '3x2' -> '3*2'

  if (allowDecimals) {
    cleaned = cleaned.replace(/[^0-9.\+\-\*\/\%\(\)\s]/g, '');
  } else {
    cleaned = cleaned.replace(/[^0-9\+\-\*\/\%\(\)\s]/g, '');
  }

  // Remove leading spaces before first valid character and multiple consecutive spaces
  cleaned = cleaned.replace(/^\s+/, '').replace(/\s{2,}/g, ' ');

  return cleaned;
}

/**
 * Tokenize a math expression string into an array of tokens.
 */
function tokenize(raw: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const str = raw.trim();

  while (i < str.length) {
    const ch = str[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '+') {
      tokens.push({ type: 'PLUS' });
      i++;
    } else if (ch === '-') {
      tokens.push({ type: 'MINUS' });
      i++;
    } else if (ch === '*' || ch === 'x' || ch === 'X') {
      tokens.push({ type: 'MULTIPLY' });
      i++;
    } else if (ch === '/') {
      tokens.push({ type: 'DIVIDE' });
      i++;
    } else if (ch === '%') {
      tokens.push({ type: 'PERCENT' });
      i++;
    } else if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      i++;
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN' });
      i++;
    } else if (/[0-9]/.test(ch) || ch === '.') {
      let numStr = '';
      let dotCount = 0;

      while (i < str.length && (/[0-9]/.test(str[i]) || str[i] === '.')) {
        if (str[i] === '.') {
          dotCount++;
          if (dotCount > 1) {
            // Invalid number like '3.1.2'
            return null;
          }
        }
        numStr += str[i];
        i++;
      }

      const numVal = parseFloat(numStr);
      if (Number.isNaN(numVal)) {
        return null;
      }
      tokens.push({ type: 'NUMBER', value: numVal });
    } else {
      // Unrecognized character
      return null;
    }
  }

  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parse(): number | null {
    if (this.tokens.length === 0) return null;
    try {
      const result = this.parseExpression();
      // If there are unconsumed tokens that couldn't be parsed, syntax error
      if (this.pos < this.tokens.length) {
        return null;
      }
      if (result == null || !Number.isFinite(result)) {
        return null;
      }
      return result;
    } catch {
      return null;
    }
  }

  // expression = term (('+' | '-') term)*
  private parseExpression(): number {
    let left = this.parseTerm();

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok && (tok.type === 'PLUS' || tok.type === 'MINUS')) {
        this.next();
        const right = this.parseTerm();
        if (tok.type === 'PLUS') {
          left += right;
        } else {
          left -= right;
        }
      } else {
        break;
      }
    }

    return left;
  }

  // term = factor (('*' | '/') factor)*
  private parseTerm(): number {
    let left = this.parseFactor();

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok && (tok.type === 'MULTIPLY' || tok.type === 'DIVIDE')) {
        this.next();
        const right = this.parseFactor();
        if (tok.type === 'MULTIPLY') {
          left *= right;
        } else {
          if (right === 0) {
            throw new Error('Division by zero');
          }
          left /= right;
        }
      } else {
        break;
      }
    }

    return left;
  }

  // factor = ('+' | '-')* primary ('%')*
  private parseFactor(): number {
    let sign = 1;

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok?.type === 'PLUS') {
        this.next();
      } else if (tok?.type === 'MINUS') {
        this.next();
        sign = -sign;
      } else {
        break;
      }
    }

    let val = sign * this.parsePrimary();

    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (tok?.type === 'PERCENT') {
        this.next();
        val = val * 0.01;
      } else {
        break;
      }
    }

    return val;
  }

  // primary = NUMBER | '(' expression ')'
  private parsePrimary(): number {
    const tok = this.peek();
    if (!tok) {
      throw new Error('Unexpected end of input');
    }

    if (tok.type === 'NUMBER') {
      this.next();
      return tok.value ?? 0;
    }

    if (tok.type === 'LPAREN') {
      this.next();
      const val = this.parseExpression();
      if (this.peek()?.type === 'RPAREN') {
        this.next();
      }
      return val;
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }
}

/**
 * Preprocess an expression to be forgiving of in-progress typing (e.g. trailing operators or open parens).
 */
function prepareForLiveEvaluation(raw: string): string {
  let str = raw.trim();

  // Normalize Unicode symbols
  str = str
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷\\]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/([0-9\)])\s*[xX]\s*([0-9\(\.])/g, '$1*$2');

  // Strip trailing operators and dangling decimal points for live preview
  str = str.replace(/[\+\-\*\/\.\s]+$/, '');

  // Count unclosed parentheses and auto-close them
  let openCount = 0;
  for (const ch of str) {
    if (ch === '(') openCount++;
    if (ch === ')') openCount--;
  }

  while (openCount > 0) {
    str += ')';
    openCount--;
  }

  return str;
}

/**
 * Check if the input contains mathematical calculation operators.
 */
export function isMathExpression(input: string): boolean {
  return /[\+\-\*\/\%\(\)×÷xX]/.test(input);
}

/**
 * Evaluates a mathematical expression deterministically.
 *
 * @param input The raw input string (e.g., "3.1+3+1", "3.1+3.2+21", "100/4", "(20+5)*1.06")
 * @param decimals Optional decimal places for formatting (defaults to 2)
 */
export function evaluateExpression(input: string, decimals: number = 2): CalcResult {
  const isExpr = isMathExpression(input);
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      result: null,
      isExpression: false,
      isValid: false,
      formatted: null,
    };
  }

  // If it's a simple number without operators, fast parse
  if (!isExpr) {
    const num = parseFloat(trimmed);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      return {
        result: num,
        isExpression: false,
        isValid: true,
        formatted: num.toFixed(decimals),
      };
    }
    return {
      result: null,
      isExpression: false,
      isValid: false,
      formatted: null,
    };
  }

  const livePrepared = prepareForLiveEvaluation(trimmed);
  if (!livePrepared) {
    return {
      result: null,
      isExpression: isExpr,
      isValid: false,
      formatted: null,
    };
  }

  const tokens = tokenize(livePrepared);
  if (!tokens || tokens.length === 0) {
    return {
      result: null,
      isExpression: isExpr,
      isValid: false,
      formatted: null,
    };
  }

  const parser = new Parser(tokens);
  const evaluated = parser.parse();

  if (evaluated == null || !Number.isFinite(evaluated)) {
    return {
      result: null,
      isExpression: isExpr,
      isValid: false,
      formatted: null,
    };
  }

  const rounded = round2(evaluated);

  return {
    result: rounded,
    isExpression: isExpr,
    isValid: true,
    formatted: rounded.toFixed(decimals),
  };
}
