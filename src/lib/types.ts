export interface Ingredient {
  /** Numeric and nullable — "salt, to taste" has no amount. */
  amount: number | null;
  /** Free text, backed by a datalist of units already used. */
  unit: string;
  name: string;
  note: string;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: Ingredient[];
  /** One entry per step, in the order they are followed. */
  steps: string[];
  createdAt: number;
  updatedAt: number;
}

/** A full snapshot of a recipe as it was before a save, keyed [recipeId+timestamp]. */
export interface RecipeVersion {
  recipeId: string;
  timestamp: number;
  snapshot: Recipe;
}

/** An in-progress edit, autosaved so a backgrounded tab loses nothing. */
export interface Draft {
  recipeId: string;
  recipe: Recipe;
  savedAt: number;
}

export interface BackupFile {
  format: 'recipe-manager-backup';
  version: 1;
  exportedAt: number;
  recipes: Recipe[];
  versions: RecipeVersion[];
}

export function emptyIngredient(): Ingredient {
  return { amount: null, unit: '', name: '', note: '' };
}
