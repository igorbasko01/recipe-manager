import { useMemo, useState } from 'react';
import { formatAmount } from '../lib/amount';
import type { RecipeStore } from '../lib/store';
import type { Recipe } from '../lib/types';
import { useStoreState } from './hooks';

function summarize(recipe: Recipe): string {
  const names = recipe.ingredients.map((i) => i.name).filter(Boolean);
  if (!names.length) return 'No ingredients yet';
  return names.slice(0, 4).join(' · ') + (names.length > 4 ? ' · …' : '');
}

interface Props {
  store: RecipeStore;
  onOpen: (id: string) => void;
  onNew: () => void;
  onBackup: () => void;
}

export function RecipeList({ store, onOpen, onNew, onBackup }: Props) {
  const state = useStoreState(store);
  const [query, setQuery] = useState('');
  const results = useMemo(() => store.query(query), [store, query, state.recipes]);

  return (
    <div className="list-screen">
      <header className="bar">
        <h1>Recipes</h1>
        <div className="bar-actions">
          <button type="button" className="ghost" onClick={onBackup}>Backup</button>
          <button type="button" className="primary" onClick={onNew}>New</button>
        </div>
      </header>

      <input
        className="search"
        type="search"
        aria-label="Search recipes"
        placeholder="Search recipes, ingredients, steps…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      {state.loading ? (
        <p className="empty">Loading…</p>
      ) : results.length === 0 ? (
        <p className="empty">
          {query
            ? `Nothing matches “${query}”.`
            : 'No recipes yet. Add your first one.'}
        </p>
      ) : (
        <ul className="cards">
          {results.map((recipe) => (
            <li key={recipe.id}>
              <button type="button" className="card" onClick={() => onOpen(recipe.id)}>
                <span className="card-title">{recipe.title || 'Untitled'}</span>
                <span className="card-meta">{summarize(recipe)}</span>
                <span className="card-count">
                  {recipe.ingredients.length} ingredient{recipe.ingredients.length === 1 ? '' : 's'}
                  {recipe.ingredients[0]?.amount !== null && recipe.ingredients[0]
                    ? ` · from ${formatAmount(recipe.ingredients[0].amount)} ${recipe.ingredients[0].unit}`.trimEnd()
                    : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
