import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { exportBackup, serializeBackup, importBackup, parseBackup } from './backup';
import { createRecipe, saveRecipe, listRecipes, listVersions } from './repository';
import type { Recipe } from './types';

function sample(title: string): Recipe {
  return {
    ...createRecipe(),
    title,
    ingredients: [{ amount: 0.5, unit: 'cup', name: 'sugar', note: '' }],
    steps: ['Stir.'],
  };
}

beforeEach(async () => {
  await db.recipes.clear();
  await db.versions.clear();
  await db.drafts.clear();
});

describe('exportBackup', () => {
  it('includes every recipe and its version history', async () => {
    const a = await saveRecipe(sample('A'));
    await saveRecipe({ ...a, title: 'A edited' });
    await saveRecipe(sample('B'));

    const backup = await exportBackup();

    expect(backup.format).toBe('recipe-manager-backup');
    expect(backup.version).toBe(1);
    expect(backup.recipes).toHaveLength(2);
    expect(backup.versions).toHaveLength(1);
    expect(backup.versions[0].snapshot.title).toBe('A');
  });

  it('serializes to readable JSON that parses back', () => {
    const backup = {
      format: 'recipe-manager-backup' as const,
      version: 1 as const,
      exportedAt: 123,
      recipes: [sample('A')],
      versions: [],
    };
    expect(parseBackup(serializeBackup(backup))).toEqual(backup);
  });
});

describe('parseBackup', () => {
  it('rejects malformed JSON', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/i);
  });

  it('rejects a file that is not a recipe backup', () => {
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow(/not a recipe backup/i);
  });

  it('rejects a future backup format version', () => {
    const file = JSON.stringify({
      format: 'recipe-manager-backup',
      version: 99,
      exportedAt: 0,
      recipes: [],
      versions: [],
    });
    expect(() => parseBackup(file)).toThrow(/newer/i);
  });

  it('accepts a backup with no versions array, treating history as empty', () => {
    const file = JSON.stringify({
      format: 'recipe-manager-backup',
      version: 1,
      exportedAt: 0,
      recipes: [],
    });
    expect(parseBackup(file).versions).toEqual([]);
  });
});

describe('importBackup', () => {
  it('restores recipes and history into an empty database', async () => {
    const a = await saveRecipe(sample('A'));
    await saveRecipe({ ...a, title: 'A edited' });
    const backup = await exportBackup();

    await db.recipes.clear();
    await db.versions.clear();

    const result = await importBackup(backup);

    expect(result).toEqual({ recipes: 1, versions: 1 });
    expect((await listRecipes())[0].title).toBe('A edited');
    expect(await listVersions(a.id)).toHaveLength(1);
  });

  it('merges into existing data without creating duplicates', async () => {
    const a = await saveRecipe(sample('A'));
    const backup = await exportBackup();
    await saveRecipe(sample('B'));

    await importBackup(backup);

    const recipes = await listRecipes();
    expect(recipes).toHaveLength(2);
    expect(recipes.filter((r) => r.id === a.id)).toHaveLength(1);
  });

  it('lets an imported recipe overwrite the local copy with the same id', async () => {
    const a = await saveRecipe(sample('A'));
    const backup = await exportBackup();
    await db.recipes.put({ ...a, title: 'locally changed' });

    await importBackup(backup);

    expect((await db.recipes.get(a.id))!.title).toBe('A');
  });

  it('imports a round-tripped JSON string end to end', async () => {
    const a = await saveRecipe(sample('A'));
    await saveRecipe({ ...a, title: 'A edited' });
    const json = serializeBackup(await exportBackup());

    await db.recipes.clear();
    await db.versions.clear();

    await importBackup(parseBackup(json));

    expect((await listRecipes())[0].title).toBe('A edited');
    expect((await listVersions(a.id))[0].snapshot.title).toBe('A');
  });

  it('skips entries that are not shaped like recipes', async () => {
    const result = await importBackup({
      format: 'recipe-manager-backup',
      version: 1,
      exportedAt: 0,
      recipes: [sample('good'), { id: 'bad' } as unknown as Recipe],
      versions: [],
    });
    expect(result.recipes).toBe(1);
    expect(await listRecipes()).toHaveLength(1);
  });

  it('skips recipes whose steps are not a list of strings', async () => {
    const { steps: _, ...withoutSteps } = sample('no steps');
    const result = await importBackup({
      format: 'recipe-manager-backup',
      version: 1,
      exportedAt: 0,
      recipes: [
        sample('good'),
        { ...withoutSteps, instructions: 'Stir.' } as unknown as Recipe,
        { ...sample('bad step'), steps: ['Stir.', 3] } as unknown as Recipe,
      ],
      versions: [],
    });
    expect(result.recipes).toBe(1);
    expect((await listRecipes())[0].steps).toEqual(['Stir.']);
  });
});
