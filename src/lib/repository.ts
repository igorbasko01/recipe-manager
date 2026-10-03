import { db } from './db';
import { emptyIngredient, type Draft, type Recipe, type RecipeVersion } from './types';

/** Recipes are plain JSON, so a JSON round-trip is a sufficient deep copy. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRecipe(): Recipe {
  const now = Date.now();
  return {
    id: newId(),
    title: '',
    ingredients: [emptyIngredient()],
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id);
}

export async function listRecipes(): Promise<Recipe[]> {
  return db.recipes.orderBy('updatedAt').reverse().toArray();
}

/**
 * Write a recipe, snapshotting whatever was there before. The snapshot is what
 * makes every save undoable; a first save has no previous state to keep.
 */
export async function saveRecipe(recipe: Recipe): Promise<Recipe> {
  const next = clone(recipe);

  return db.transaction('rw', db.recipes, db.versions, async () => {
    const previous = await db.recipes.get(next.id);
    if (previous) {
      await db.versions.add({
        recipeId: previous.id,
        timestamp: await nextVersionTimestamp(previous.id),
        snapshot: previous,
      });
      next.createdAt = previous.createdAt;
    }
    next.updatedAt = Math.max(Date.now(), previous?.updatedAt ?? 0);
    await db.recipes.put(next);
    return next;
  });
}

/**
 * [recipeId, timestamp] is the version key, so two saves within the same
 * millisecond must not collide. Step forward until the slot is free.
 */
async function nextVersionTimestamp(recipeId: string): Promise<number> {
  let timestamp = Date.now();
  while (await db.versions.get([recipeId, timestamp])) timestamp += 1;
  return timestamp;
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.transaction('rw', db.recipes, db.versions, db.drafts, async () => {
    await db.recipes.delete(id);
    await db.versions.where('recipeId').equals(id).delete();
    await db.drafts.delete(id);
  });
}

export async function listVersions(recipeId: string): Promise<RecipeVersion[]> {
  const versions = await db.versions.where('recipeId').equals(recipeId).toArray();
  return versions.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getVersion(
  recipeId: string,
  timestamp: number,
): Promise<RecipeVersion | undefined> {
  return db.versions.get([recipeId, timestamp]);
}

/** Restore a snapshot. The revert is itself a save, so it too can be undone. */
export async function revertTo(recipeId: string, timestamp: number): Promise<Recipe> {
  const version = await getVersion(recipeId, timestamp);
  if (!version) throw new Error(`No version ${timestamp} for recipe ${recipeId}`);
  return saveRecipe({ ...version.snapshot, id: recipeId });
}

export async function knownUnits(): Promise<string[]> {
  const units = new Set<string>();
  await db.recipes.each((recipe) => {
    for (const ingredient of recipe.ingredients) {
      const unit = ingredient.unit.trim();
      if (unit) units.add(unit);
    }
  });
  return [...units].sort((a, b) => a.localeCompare(b));
}

export async function saveDraft(recipe: Recipe): Promise<void> {
  await db.drafts.put({ recipeId: recipe.id, recipe: clone(recipe), savedAt: Date.now() });
}

export async function getDraft(recipeId: string): Promise<Draft | undefined> {
  return db.drafts.get(recipeId);
}

export async function clearDraft(recipeId: string): Promise<void> {
  await db.drafts.delete(recipeId);
}
