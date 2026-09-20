/**
 * Amount parsing/formatting. Recipe amounts are stored as nullable numbers
 * ("salt, to taste" has no amount) but are written and read as fractions.
 */

const VULGAR: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6',
  '⅚': '5/6', '⅐': '1/7', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8',
  '⅞': '7/8', '⅑': '1/9', '⅒': '1/10', '↉': '0/3',
};

const VULGAR_RE = new RegExp(`[${Object.keys(VULGAR).join('')}]`, 'g');

/** Denominators worth showing as fractions; anything else stays decimal. */
const DENOMINATORS = [2, 3, 4, 6, 8, 16];
const EPSILON = 1e-6;

export function parseAmount(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null) return null;

  const normalized = raw
    .replace(VULGAR_RE, (c) => ` ${VULGAR[c]} `)
    .replace(/\s*\/\s*/g, '/')
    .trim()
    .replace(/\s+/g, ' ');

  if (normalized === '') return null;

  const parts = normalized.split(' ');
  if (parts.length > 2) return null;

  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const value = parseTerm(parts[i]);
    if (value === null) return null;
    // A fraction may only follow a whole number, never the other way round.
    if (i === 1 && !parts[1].includes('/')) return null;
    total += value;
  }
  return total;
}

function parseTerm(term: string): number | null {
  const fraction = /^(\d+)\/(\d+)$/.exec(term);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }
  if (/^\d+(\.\d+)?$/.test(term)) return Number(term);
  return null;
}

export function formatAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (Number.isInteger(value)) return String(value);

  const whole = Math.floor(value);
  const remainder = value - whole;

  for (const denominator of DENOMINATORS) {
    const numerator = remainder * denominator;
    const rounded = Math.round(numerator);
    if (rounded > 0 && rounded < denominator && Math.abs(numerator - rounded) < EPSILON) {
      const fraction = `${rounded}/${denominator}`;
      return whole > 0 ? `${whole} ${fraction}` : fraction;
    }
  }

  return String(Number(value.toFixed(4)));
}
