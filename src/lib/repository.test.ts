import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from './db';
import {
  createRecipe,
  saveRecipe,
  deleteRecipe,
  getRecipe,
  listRecipes,
  listVersions,
  getVersion,
  revertTo,
  knownUnits,
  saveDraft,
  getDraft,
  clearDraft,
} from './repository';
import type { Recipe } from './types';

function sample(overrides: Partial<Recipe> = {}): Recipe {
  return {
    ...createRecipe(),
    title: 'Pancakes',
    ingredients: [{ amount: 1.5, unit: 'cup', name: 'flour', note: 'sifted' }],
    steps: ['Mix.', 'Fry.'],
    ...overrides,
  };
}

beforeEach(async () => {
  await db.recipes.clear();
  await db.versions.clear();
  await db.drafts.clear();
});

describe('createRecipe', () => {
  it('produces a blank recipe with a unique id and one empty ingredient row', () => {
    const a = createRecipe();
    const b = createRecipe();
    expect(a.id).not.toBe(b.id);
    expect(a.title).toBe('');
    expect(a.ingredients).toHaveLength(1);
    expect(a.ingredients[0]).toEqual({ amount: null, unit: '', name: '', note: '' });
    expect(a.steps).toEqual([]);
  });
});

describe('saveRecipe', () => {
  it('persists a new recipe and returns it', async () => {
    const saved = await saveRecipe(sample());
    expect(await getRecipe(saved.id)).toMatchObject({ title: 'Pancakes' });
  });

  it('writes no version for a first save, since there is no previous state', async () => {
    const saved = await saveRecipe(sample());
    expect(await listVersions(saved.id)).toHaveLength(0);
  });

  it('snapshots the previous state on every subsequent save', async () => {
    const first = await saveRecipe(sample({ title: 'v1' }));
    await saveRecipe({ ...first, title: 'v2' });
    await saveRecipe({ ...first, title: 'v3' });

    const versions = await listVersions(first.id);
    expect(versions.map((v) => v.snapshot.title)).toEqual(['v2', 'v1']);
  });

  it('lists versions newest first', async () => {
    const first = await saveRecipe(sample({ title: 'a' }));
    await saveRecipe({ ...first, title: 'b' });
    await saveRecipe({ ...first, title: 'c' });

    const versions = await listVersions(first.id);
    expect(versions[0].timestamp).toBeGreaterThanOrEqual(versions[1].timestamp);
  });

  it('gives each version of a recipe a distinct timestamp key', async () => {
    const first = await saveRecipe(sample({ title: 'a' }));
    for (const title of ['b', 'c', 'd', 'e']) {
      await saveRecipe({ ...first, title });
    }
    const versions = await listVersions(first.id);
    expect(new Set(versions.map((v) => v.timestamp)).size).toBe(versions.length);
    expect(versions).toHaveLength(4);
  });

  it('advances updatedAt but keeps createdAt', async () => {
    const first = await saveRecipe(sample());
    const second = await saveRecipe({ ...first, title: 'changed' });
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
  });

  it('stores a deep copy, so later mutation of the input does not leak into the store', async () => {
    const recipe = sample();
    const saved = await saveRecipe(recipe);
    recipe.ingredients[0].name = 'mutated';
    expect((await getRecipe(saved.id))!.ingredients[0].name).toBe('flour');
  });
});

describe('steps', () => {
  it('round-trip through save and reload in order', async () => {
    const saved = await saveRecipe(sample({ steps: ['Whisk.', 'Rest.', 'Fry.'] }));
    expect((await getRecipe(saved.id))?.steps).toEqual(['Whisk.', 'Rest.', 'Fry.']);
  });

  it('keep a reordering across a save, with the old order in history', async () => {
    const saved = await saveRecipe(sample({ steps: ['Whisk.', 'Rest.'] }));
    await saveRecipe({ ...saved, steps: ['Rest.', 'Whisk.'] });

    expect((await getRecipe(saved.id))?.steps).toEqual(['Rest.', 'Whisk.']);
    expect((await listVersions(saved.id))[0].snapshot.steps).toEqual(['Whisk.', 'Rest.']);
  });
});

describe('listRecipes', () => {
  it('returns recipes most recently updated first', async () => {
    // Saves in the same millisecond would tie on updatedAt; step the clock.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000);
      const a = await saveRecipe(sample({ title: 'A' }));
      vi.setSystemTime(2_000);
      await saveRecipe(sample({ title: 'B' }));
      vi.setSystemTime(3_000);
      await saveRecipe({ ...a, title: 'A again' });
    } finally {
      vi.useRealTimers();
    }

    expect((await listRecipes()).map((r) => r.title)).toEqual(['A again', 'B']);
  });
});

describe('deleteRecipe', () => {
  it('removes the recipe along with its versions and draft', async () => {
    const saved = await saveRecipe(sample());
    await saveRecipe({ ...saved, title: 'second' });
    await saveDraft({ ...saved, title: 'draft' });

    await deleteRecipe(saved.id);

    expect(await getRecipe(saved.id)).toBeUndefined();
    expect(await listVersions(saved.id)).toHaveLength(0);
    expect(await getDraft(saved.id)).toBeUndefined();
  });
});

describe('revertTo', () => {
  it('restores an older snapshot as the current recipe', async () => {
    const first = await saveRecipe(sample({ title: 'original' }));
    await saveRecipe({ ...first, title: 'edited' });

    const [version] = await listVersions(first.id);
    const reverted = await revertTo(first.id, version.timestamp);

    expect(reverted.title).toBe('original');
    expect((await getRecipe(first.id))!.title).toBe('original');
  });

  it('records the pre-revert state as a version, so a revert is itself undoable', async () => {
    const first = await saveRecipe(sample({ title: 'original' }));
    await saveRecipe({ ...first, title: 'edited' });
    const [version] = await listVersions(first.id);

    await revertTo(first.id, version.timestamp);

    const titles = (await listVersions(first.id)).map((v) => v.snapshot.title);
    expect(titles).toContain('edited');
  });

  it('keeps the recipe id stable across a revert', async () => {
    const first = await saveRecipe(sample());
    await saveRecipe({ ...first, title: 'edited' });
    const [version] = await listVersions(first.id);
    expect((await revertTo(first.id, version.timestamp)).id).toBe(first.id);
  });

  it('rejects an unknown version', async () => {
    const saved = await saveRecipe(sample());
    await expect(revertTo(saved.id, 123)).rejects.toThrow(/version/i);
  });
});

describe('getVersion', () => {
  it('reads back a single snapshot by its key', async () => {
    const first = await saveRecipe(sample({ title: 'original' }));
    await saveRecipe({ ...first, title: 'edited' });
    const [version] = await listVersions(first.id);
    expect((await getVersion(first.id, version.timestamp))!.snapshot.title).toBe('original');
  });
});

describe('knownUnits', () => {
  it('collects the distinct units already used, sorted', async () => {
    await saveRecipe(sample({ ingredients: [
      { amount: 1, unit: 'tbsp', name: 'oil', note: '' },
      { amount: 2, unit: 'cup', name: 'flour', note: '' },
    ] }));
    await saveRecipe(sample({ ingredients: [
      { amount: 1, unit: 'cup', name: 'milk', note: '' },
      { amount: null, unit: '', name: 'salt', note: 'to taste' },
    ] }));

    expect(await knownUnits()).toEqual(['cup', 'tbsp']);
  });
});

describe('drafts', () => {
  it('round-trips a draft and clears it', async () => {
    const recipe = sample({ title: 'half typed' });
    await saveDraft(recipe);
    expect((await getDraft(recipe.id))!.recipe.title).toBe('half typed');

    await clearDraft(recipe.id);
    expect(await getDraft(recipe.id)).toBeUndefined();
  });

  it('overwrites the previous draft for the same recipe', async () => {
    const recipe = sample();
    await saveDraft({ ...recipe, title: 'one' });
    await saveDraft({ ...recipe, title: 'two' });
    expect(await db.drafts.count()).toBe(1);
    expect((await getDraft(recipe.id))!.recipe.title).toBe('two');
  });
});
