import { describe, it, expect } from 'vitest';
import { parseAmount, formatAmount } from './amount';

describe('parseAmount', () => {
  it('parses plain integers and decimals', () => {
    expect(parseAmount('2')).toBe(2);
    expect(parseAmount('0.5')).toBe(0.5);
    expect(parseAmount('1.25')).toBe(1.25);
  });

  it('parses simple fractions', () => {
    expect(parseAmount('1/2')).toBe(0.5);
    expect(parseAmount('3/4')).toBe(0.75);
    expect(parseAmount('2/3')).toBeCloseTo(0.6666667, 6);
  });

  it('parses mixed numbers', () => {
    expect(parseAmount('1 1/2')).toBe(1.5);
    expect(parseAmount('2 3/4')).toBe(2.75);
  });

  it('parses unicode vulgar fractions, alone and mixed', () => {
    expect(parseAmount('½')).toBe(0.5);
    expect(parseAmount('1½')).toBe(1.5);
    expect(parseAmount('1 ¾')).toBe(1.75);
    expect(parseAmount('⅓')).toBeCloseTo(0.3333333, 6);
  });

  it('tolerates surrounding and internal whitespace', () => {
    expect(parseAmount('  1 1/2  ')).toBe(1.5);
    expect(parseAmount('1  /  2')).toBe(0.5);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('to taste')).toBeNull();
    expect(parseAmount('a pinch')).toBeNull();
  });

  it('returns null rather than Infinity for a zero denominator', () => {
    expect(parseAmount('1/0')).toBeNull();
  });

  it('ignores a negative sign, since recipes have no negative amounts', () => {
    expect(parseAmount('-2')).toBeNull();
  });

  it('passes numbers through unchanged', () => {
    expect(parseAmount(3)).toBe(3);
    expect(parseAmount(null)).toBeNull();
  });
});

describe('formatAmount', () => {
  it('formats null as an empty string', () => {
    expect(formatAmount(null)).toBe('');
  });

  it('formats whole numbers without decimals', () => {
    expect(formatAmount(2)).toBe('2');
  });

  it('formats common fractions back to fraction notation', () => {
    expect(formatAmount(0.5)).toBe('1/2');
    expect(formatAmount(0.75)).toBe('3/4');
    expect(formatAmount(1.5)).toBe('1 1/2');
    expect(formatAmount(2.25)).toBe('2 1/4');
  });

  it('falls back to a trimmed decimal for uncommon values', () => {
    expect(formatAmount(1.37)).toBe('1.37');
    expect(formatAmount(0.1)).toBe('0.1');
  });

  it('round-trips through parseAmount', () => {
    for (const raw of ['1/2', '1 1/2', '2', '3/4', '2 2/3']) {
      expect(parseAmount(formatAmount(parseAmount(raw)))).toBeCloseTo(parseAmount(raw)!, 6);
    }
  });
});
