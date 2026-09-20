import { emptyIngredient, type Ingredient } from './types';

/** All of these return a new array; the editor holds ingredients in React state. */

export function addRow<T extends Ingredient>(
  rows: T[],
  afterIndex?: number,
  makeEmpty: () => T = emptyIngredient as () => T,
): T[] {
  const next = [...rows];
  const at = afterIndex === undefined ? next.length : afterIndex + 1;
  next.splice(at, 0, makeEmpty());
  return next;
}

/** Removing the last row leaves a blank one, so the form always has a place to type. */
export function removeRow<T extends Ingredient>(
  rows: T[],
  index: number,
  makeEmpty: () => T = emptyIngredient as () => T,
): T[] {
  if (index < 0 || index >= rows.length) return rows;
  const next = rows.filter((_, i) => i !== index);
  return next.length ? next : [makeEmpty()];
}

export function moveRow<T extends Ingredient>(rows: T[], from: number, to: number): T[] {
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return rows;
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

export function updateRow<T extends Ingredient>(
  rows: T[],
  index: number,
  patch: Partial<T>,
): T[] {
  if (index < 0 || index >= rows.length) return rows;
  return rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
}
