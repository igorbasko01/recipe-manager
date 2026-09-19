import MiniSearch from 'minisearch';
import type { Recipe } from './types';

export interface SearchHit {
  id: string;
  score: number;
}

interface IndexedRecipe {
  id: string;
  title: string;
  ingredients: string;
  instructions: string;
}

function toDocument(recipe: Recipe): IndexedRecipe {
  return {
    id: recipe.id,
    title: recipe.title,
    ingredients: recipe.ingredients.map((i) => `${i.name} ${i.note}`.trim()).join(' '),
    instructions: recipe.instructions,
  };
}

/**
 * In-memory full-text index over the recipe store. Built at startup from
 * IndexedDB and kept in step incrementally as recipes are saved.
 */
export class RecipeSearch {
  private index: MiniSearch<IndexedRecipe>;
  private indexed = new Set<string>();

  constructor() {
    this.index = new MiniSearch<IndexedRecipe>({
      fields: ['title', 'ingredients', 'instructions'],
      storeFields: ['id'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: { title: 3, ingredients: 2 },
        combineWith: 'AND',
      },
    });
  }

  addAll(recipes: Recipe[]): void {
    for (const recipe of recipes) this.update(recipe);
  }

  /** Add or replace a single recipe. */
  update(recipe: Recipe): void {
    this.remove(recipe.id);
    this.index.add(toDocument(recipe));
    this.indexed.add(recipe.id);
  }

  remove(id: string): void {
    if (!this.indexed.has(id)) return;
    this.index.discard(id);
    this.indexed.delete(id);
  }

  search(query: string): SearchHit[] {
    if (!query.trim()) return [];
    return this.index.search(query).map((result) => ({ id: result.id as string, score: result.score }));
  }
}
