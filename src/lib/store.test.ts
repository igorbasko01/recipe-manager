import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { RecipeStore } from './store';
import { createRecipe } from './repository';
import type { Recipe } from './types';

function sample(title: string, ingredients: string[] = ['flour']): Recipe {
  return {
    ...createRecipe(),
    title,
    ingredients: ingredients.map((name) => ({ amount: 1, unit: 'cup', name, note: '' })),
    steps: [`How to make ${title}.`],
  };
}

let store: RecipeStore;

beforeEach(async () => {
  await db.recipes.clear();
  await db.versions.clear();
  await db.drafts.clear();
  store = new RecipeStore();
});

describe('RecipeStore', () => {
  it('starts empty and loading', () => {
    expect(store.getState().recipes).toEqual([]);
    expect(store.getState().loading).toBe(true);
  });

  it('loads recipes from the database and clears loading', async () => {
    await db.recipes.bulkPut([sample('A'), sample('B')]);
    await store.load();
    expect(store.getState().recipes).toHaveLength(2);
    expect(store.getState().loading).toBe(false);
  });

  it('notifies subscribers when state changes', async () => {
    let calls = 0;
    store.subscribe(() => { calls += 1; });
    await store.load();
    expect(calls).toBeGreaterThan(0);
  });

  it('stops notifying after unsubscribe', async () => {
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls += 1; });
    unsubscribe();
    await store.load();
    expect(calls).toBe(0);
  });

  it('returns all recipes, newest first, for an empty query', async () => {
    await store.load();
    await store.save(sample('First'));
    await store.save(sample('Second'));
    expect(store.query('').map((r) => r.title)).toEqual(['Second', 'First']);
  });

  it('filters by query across titles and ingredients', async () => {
    await store.load();
    await store.save(sample('Pancakes', ['flour', 'milk']));
    await store.save(sample('Tomato Soup', ['tomato']));

    expect(store.query('tomato').map((r) => r.title)).toEqual(['Tomato Soup']);
    expect(store.query('milk').map((r) => r.title)).toEqual(['Pancakes']);
  });

  it('keeps the search index current when a recipe is saved', async () => {
    await store.load();
    const saved = await store.save(sample('Pancakes'));
    await store.save({ ...saved, title: 'Crepes', steps: ['Thin batter.'] });

    expect(store.query('crepes').map((r) => r.title)).toEqual(['Crepes']);
    expect(store.query('pancakes')).toEqual([]);
  });

  it('drops a deleted recipe from both state and the index', async () => {
    await store.load();
    const saved = await store.save(sample('Pancakes'));
    await store.remove(saved.id);

    expect(store.getState().recipes).toEqual([]);
    expect(store.query('pancakes')).toEqual([]);
  });

  it('reverting updates the visible recipe and the index', async () => {
    await store.load();
    const saved = await store.save(sample('Original'));
    await store.save({ ...saved, title: 'Changed' });
    const versions = await store.versions(saved.id);

    await store.revert(saved.id, versions[0].timestamp);

    expect(store.getState().recipes[0].title).toBe('Original');
    expect(store.query('original').map((r) => r.title)).toEqual(['Original']);
  });

  it('exposes the units already used for the datalist', async () => {
    await store.load();
    await store.save(sample('A'));
    expect(store.getState().units).toContain('cup');
  });

  it('refreshes fully after a backup import', async () => {
    await store.load();
    await db.recipes.put(sample('Imported'));
    await store.refresh();

    expect(store.getState().recipes.map((r) => r.title)).toEqual(['Imported']);
    expect(store.query('imported')).toHaveLength(1);
  });

  it('finds a recipe by id from in-memory state', async () => {
    await store.load();
    const saved = await store.save(sample('Findable'));
    expect(store.find(saved.id)!.title).toBe('Findable');
    expect(store.find('missing')).toBeUndefined();
  });
});
