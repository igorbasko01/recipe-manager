import {
  deleteRecipe,
  knownUnits,
  listRecipes,
  listVersions,
  revertTo,
  saveRecipe,
} from './repository';
import { RecipeSearch } from './search';
import type { Recipe, RecipeVersion } from './types';

export interface StoreState {
  recipes: Recipe[];
  units: string[];
  loading: boolean;
}

type Listener = () => void;

/**
 * The app's single source of truth: recipes held in memory for instant
 * rendering and searching, with IndexedDB as the durable copy behind it.
 */
export class RecipeStore {
  private state: StoreState = { recipes: [], units: [], loading: true };
  private listeners = new Set<Listener>();
  private search = new RecipeSearch();

  getState = (): StoreState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(next: Partial<StoreState>): void {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  /** Initial read: load every recipe and build the full-text index. */
  load = async (): Promise<void> => {
    const [recipes, units] = await Promise.all([listRecipes(), knownUnits()]);
    this.search = new RecipeSearch();
    this.search.addAll(recipes);
    this.setState({ recipes, units, loading: false });
  };

  /** Re-read everything — used after an import rewrites the store wholesale. */
  refresh = this.load;

  find = (id: string): Recipe | undefined => this.state.recipes.find((r) => r.id === id);

  save = async (recipe: Recipe): Promise<Recipe> => {
    const saved = await saveRecipe(recipe);
    this.search.update(saved);
    const others = this.state.recipes.filter((r) => r.id !== saved.id);
    this.setState({
      recipes: [saved, ...others].sort((a, b) => b.updatedAt - a.updatedAt),
      units: await knownUnits(),
    });
    return saved;
  };

  remove = async (id: string): Promise<void> => {
    await deleteRecipe(id);
    this.search.remove(id);
    this.setState({
      recipes: this.state.recipes.filter((r) => r.id !== id),
      units: await knownUnits(),
    });
  };

  versions = (recipeId: string): Promise<RecipeVersion[]> => listVersions(recipeId);

  revert = async (recipeId: string, timestamp: number): Promise<Recipe> => {
    const reverted = await revertTo(recipeId, timestamp);
    this.search.update(reverted);
    this.setState({
      recipes: this.state.recipes
        .map((r) => (r.id === reverted.id ? reverted : r))
        .sort((a, b) => b.updatedAt - a.updatedAt),
      units: await knownUnits(),
    });
    return reverted;
  };

  /** Empty query lists everything, newest first; otherwise rank by relevance. */
  query = (text: string): Recipe[] => {
    if (!text.trim()) return this.state.recipes;
    const byId = new Map(this.state.recipes.map((r) => [r.id, r]));
    return this.search
      .search(text)
      .map((hit) => byId.get(hit.id))
      .filter((r): r is Recipe => r !== undefined);
  };
}
