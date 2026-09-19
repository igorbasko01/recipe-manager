import { formatAmount } from '../lib/amount';
import type { RecipeStore } from '../lib/store';
import type { Recipe } from '../lib/types';
import { useStoreState } from './hooks';

interface Props {
  store: RecipeStore;
  recipeId: string;
  onEdit: () => void;
  onHistory: () => void;
  onBack: () => void;
}

export function RecipeView({ store, recipeId, onEdit, onHistory, onBack }: Props) {
  useStoreState(store);
  const recipe = store.find(recipeId);

  if (!recipe) return <p className="empty">That recipe is gone.</p>;

  async function handleDelete() {
    if (!recipe) return;
    if (!window.confirm(`Delete “${recipe.title || 'Untitled'}” and its history?`)) return;
    await store.remove(recipe.id);
    onBack();
  }

  return (
    <article className="view">
      <header className="bar">
        <button type="button" className="ghost" onClick={onBack}>Back</button>
        <div className="bar-actions">
          <button type="button" className="ghost" onClick={onHistory}>History</button>
          <button type="button" className="primary" onClick={onEdit}>Edit</button>
        </div>
      </header>

      <h1 className="recipe-title">{recipe.title || 'Untitled'}</h1>

      <RecipeBody recipe={recipe} />

      <footer className="view-footer">
        <button type="button" className="danger" onClick={handleDelete}>Delete recipe</button>
      </footer>
    </article>
  );
}

export function RecipeBody({ recipe }: { recipe: Recipe }) {
  return (
    <>
      <section>
        <h2>Ingredients</h2>
        {recipe.ingredients.length === 0 ? (
          <p className="empty">None listed.</p>
        ) : (
          <ul className="ingredients">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                <span className="qty">
                  {[formatAmount(ingredient.amount), ingredient.unit].filter(Boolean).join(' ')}
                </span>
                <span className="ing-name">{ingredient.name}</span>
                {ingredient.note && <span className="ing-note">{ingredient.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Instructions</h2>
        {recipe.instructions.trim() ? (
          <div className="instructions">{recipe.instructions}</div>
        ) : (
          <p className="empty">None written.</p>
        )}
      </section>
    </>
  );
}
