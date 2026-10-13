import { describe, it, expect } from 'vitest';
import { addRow, removeRow, moveRow, updateRow } from './ingredients';
import type { Ingredient } from './types';

const rows: Ingredient[] = [
  { amount: 1, unit: 'cup', name: 'flour', note: '' },
  { amount: 2, unit: '', name: 'eggs', note: '' },
  { amount: null, unit: '', name: 'salt', note: 'to taste' },
];

describe('addRow', () => {
  it('appends a blank row', () => {
    const next = addRow(rows);
    expect(next).toHaveLength(4);
    expect(next[3]).toEqual({ amount: null, unit: '', name: '', note: '' });
  });

  it('inserts after a given index', () => {
    expect(addRow(rows, 0).map((r) => r.name)).toEqual(['flour', '', 'eggs', 'salt']);
  });

  it('does not mutate the input', () => {
    addRow(rows);
    expect(rows).toHaveLength(3);
  });
});

describe('removeRow', () => {
  it('removes the row at an index', () => {
    expect(removeRow(rows, 1).map((r) => r.name)).toEqual(['flour', 'salt']);
  });

  it('keeps one blank row rather than emptying the list entirely', () => {
    const single: Ingredient[] = [{ amount: 1, unit: '', name: 'only', note: '' }];
    const next = removeRow(single, 0);
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('');
  });

  it('ignores an out-of-range index', () => {
    expect(removeRow(rows, 9)).toEqual(rows);
  });
});

describe('moveRow', () => {
  it('moves a row down', () => {
    expect(moveRow(rows, 0, 1).map((r) => r.name)).toEqual(['eggs', 'flour', 'salt']);
  });

  it('moves a row up', () => {
    expect(moveRow(rows, 2, 0).map((r) => r.name)).toEqual(['salt', 'flour', 'eggs']);
  });

  it('is a no-op when the target is out of range', () => {
    expect(moveRow(rows, 0, -1)).toEqual(rows);
    expect(moveRow(rows, 2, 3)).toEqual(rows);
  });

  it('does not mutate the input', () => {
    moveRow(rows, 0, 2);
    expect(rows.map((r) => r.name)).toEqual(['flour', 'eggs', 'salt']);
  });
});

describe('updateRow', () => {
  it('patches a single field of one row', () => {
    const next = updateRow(rows, 1, { name: 'egg yolks' });
    expect(next[1]).toEqual({ amount: 2, unit: '', name: 'egg yolks', note: '' });
    expect(next[0]).toEqual(rows[0]);
  });

  it('ignores an out-of-range index', () => {
    expect(updateRow(rows, 9, { name: 'nope' })).toEqual(rows);
  });
});

describe('helpers on rows that are not ingredients', () => {
  type Step = { text: string };
  const emptyStep = (): Step => ({ text: '' });
  const steps: Step[] = [{ text: 'whisk' }, { text: 'rest' }, { text: 'fry' }];

  it('adds, removes, moves and updates generic rows', () => {
    expect(addRow(steps, 0, emptyStep).map((s) => s.text)).toEqual(['whisk', '', 'rest', 'fry']);
    expect(removeRow(steps, 1, emptyStep).map((s) => s.text)).toEqual(['whisk', 'fry']);
    expect(moveRow(steps, 2, 0).map((s) => s.text)).toEqual(['fry', 'whisk', 'rest']);
    expect(updateRow(steps, 1, { text: 'rest 10 min' })[1]).toEqual({ text: 'rest 10 min' });
  });

  it('leaves a blank row of the right shape when the last is removed', () => {
    expect(removeRow([{ text: 'only' }], 0, emptyStep)).toEqual([{ text: '' }]);
  });
});
