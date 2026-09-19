import Dexie, { type Table } from 'dexie';
import type { Draft, Recipe, RecipeVersion } from './types';

export class RecipeDatabase extends Dexie {
  recipes!: Table<Recipe, string>;
  versions!: Table<RecipeVersion, [string, number]>;
  drafts!: Table<Draft, string>;

  constructor(name = 'recipe-manager') {
    super(name);
    this.version(1).stores({
      recipes: 'id, title, updatedAt',
      versions: '[recipeId+timestamp], recipeId, timestamp',
      drafts: 'recipeId, savedAt',
    });
  }
}

export const db = new RecipeDatabase();

/**
 * Ask the browser to keep our data. Best-effort: unsupported or denied is fine,
 * it only raises the odds of eviction.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
