import { describe, it, expect, beforeEach } from 'vitest';
import { RecipeSearch } from './search';
import type { Recipe } from './types';

function recipe(id: string, title: string, ingredients: string[], steps: string[] = []): Recipe {
  return {
    id,
    title,
    ingredients: ingredients.map((name) => ({ amount: null, unit: '', name, note: '' })),
    steps,
    createdAt: 0,
    updatedAt: 0,
  };
}

const pancakes = recipe('1', 'Buttermilk Pancakes', ['flour', 'buttermilk', 'egg'], ['Whisk the batter.', 'Fry in butter.']);
const soup = recipe('2', 'Tomato Soup', ['tomato', 'onion', 'cream'], ['Simmer gently for an hour.']);
const bread = recipe('3', 'Sourdough Bread', ['flour', 'water', 'salt'], ['Fold the dough every hour.']);

let search: RecipeSearch;

beforeEach(() => {
  search = new RecipeSearch();
  search.addAll([pancakes, soup, bread]);
});

describe('RecipeSearch', () => {
  it('returns every recipe id for an empty query', () => {
    expect(search.search('')).toEqual([]);
    expect(search.search('   ')).toEqual([]);
  });

  it('matches on title', () => {
    expect(search.search('tomato').map((r) => r.id)).toContain('2');
  });

  it('matches on ingredient names', () => {
    const ids = search.search('buttermilk').map((r) => r.id);
    expect(ids).toContain('1');
  });

  it('matches on step text', () => {
    const ids = search.search('simmer').map((r) => r.id);
    expect(ids).toContain('2');
  });

  it('matches text in any step, not just the first', () => {
    expect(search.search('butter').map((r) => r.id)).toContain('1');
  });

  it('matches terms spread across different steps', () => {
    expect(search.search('whisk fry').map((r) => r.id)).toEqual(['1']);
  });

  it('matches on prefixes', () => {
    expect(search.search('sourd').map((r) => r.id)).toContain('3');
    expect(search.search('pan').map((r) => r.id)).toContain('1');
  });

  it('matches fuzzily despite a typo', () => {
    expect(search.search('pancaks').map((r) => r.id)).toContain('1');
    expect(search.search('tomatoe').map((r) => r.id)).toContain('2');
  });

  it('boosts a title match above a body match for the same term', () => {
    const withTitleTerm = recipe('4', 'Onion Tart', ['pastry']);
    const withBodyTerm = recipe('5', 'Beef Stew', ['beef'], ['Add onion and cook down.']);
    search = new RecipeSearch();
    search.addAll([withTitleTerm, withBodyTerm]);

    expect(search.search('onion')[0].id).toBe('4');
  });

  it('finds several recipes sharing an ingredient', () => {
    const ids = search.search('flour').map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['1', '3']));
  });

  it('returns an empty list when nothing matches', () => {
    expect(search.search('zzzzqqqq')).toEqual([]);
  });

  it('reflects an updated recipe without a rebuild', () => {
    search.update({ ...soup, title: 'Gazpacho' });
    expect(search.search('gazpacho').map((r) => r.id)).toContain('2');
    expect(search.search('Tomato Soup').map((r) => r.id)).not.toContain('2');
  });

  it('adds a recipe incrementally', () => {
    search.update(recipe('9', 'Risotto', ['rice']));
    expect(search.search('risotto').map((r) => r.id)).toContain('9');
  });

  it('drops a removed recipe', () => {
    search.remove('2');
    expect(search.search('tomato').map((r) => r.id)).not.toContain('2');
  });

  it('tolerates removing a recipe it never indexed', () => {
    expect(() => search.remove('nope')).not.toThrow();
  });

  it('ignores case', () => {
    expect(search.search('SOURDOUGH').map((r) => r.id)).toContain('3');
  });
});
