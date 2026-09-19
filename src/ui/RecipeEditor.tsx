import { useEffect, useMemo, useState } from 'react';
import { formatAmount, parseAmount } from '../lib/amount';
import { addRow, moveRow, removeRow, updateRow } from '../lib/ingredients';
import { clearDraft, createRecipe, getDraft } from '../lib/repository';
import type { RecipeStore } from '../lib/store';
import { emptyIngredient, type Ingredient, type Recipe } from '../lib/types';
import { useDraftAutosave, useStoreState } from './hooks';

/** A row as the form holds it: the parsed amount plus the text actually typed. */
type EditorRow = Ingredient & { amountText: string };

const emptyRow = (): EditorRow => ({ ...emptyIngredient(), amountText: '' });

function toRows(ingredients: Ingredient[]): EditorRow[] {
  if (!ingredients.length) return [emptyRow()];
  return ingredients.map((i) => ({ ...i, amountText: formatAmount(i.amount) }));
}

function toIngredients(rows: EditorRow[]): Ingredient[] {
  return rows
    .filter((row) => row.name.trim() !== '')
    .map(({ amount, unit, name, note }) => ({
      amount,
      unit: unit.trim(),
      name: name.trim(),
      note: note.trim(),
    }));
}

interface Props {
  store: RecipeStore;
  recipeId: string | null;
  onSaved: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function RecipeEditor({ store, recipeId, onSaved, onCancel }: Props) {
  const { units } = useStoreState(store);
  const original = useMemo(
    () => (recipeId ? store.find(recipeId) ?? createRecipe() : createRecipe()),
    [recipeId, store],
  );

  const [title, setTitle] = useState(original.title);
  const [instructions, setInstructions] = useState(original.instructions);
  const [rows, setRows] = useState<EditorRow[]>(() => toRows(original.ingredients));
  const [draftRestored, setDraftRestored] = useState(false);
  const [saving, setSaving] = useState(false);

  // An autosaved draft means a previous session ended mid-edit; prefer it.
  useEffect(() => {
    let cancelled = false;
    void getDraft(original.id).then((draft) => {
      if (cancelled || !draft) return;
      setTitle(draft.recipe.title);
      setInstructions(draft.recipe.instructions);
      setRows(toRows(draft.recipe.ingredients));
      setDraftRestored(true);
    });
    return () => { cancelled = true; };
  }, [original.id]);

  const working: Recipe = useMemo(
    () => ({ ...original, title, instructions, ingredients: toIngredients(rows) }),
    [original, title, instructions, rows],
  );

  useDraftAutosave(working, !saving);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const saved = await store.save({ ...working, title: title.trim() || 'Untitled' });
    await clearDraft(saved.id);
    onSaved(saved);
  }

  async function handleCancel() {
    setSaving(true);
    await clearDraft(original.id);
    onCancel();
  }

  function setAmount(index: number, text: string) {
    setRows((current) => updateRow(current, index, {
      amountText: text,
      amount: parseAmount(text),
    } as Partial<EditorRow>));
  }

  /** On blur, rewrite what was typed in canonical form: "1 1/2", not "1.5". */
  function normalizeAmount(index: number) {
    setRows((current) => {
      const row = current[index];
      if (!row || row.amount === null) return current;
      return updateRow(current, index, { amountText: formatAmount(row.amount) } as Partial<EditorRow>);
    });
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <header className="bar">
        <button type="button" className="ghost" onClick={handleCancel}>Cancel</button>
        <h2>{recipeId ? 'Edit recipe' : 'New recipe'}</h2>
        <button type="submit" className="primary">Save</button>
      </header>

      {draftRestored && (
        <p className="notice" role="status">Restored your unsaved changes.</p>
      )}

      <label className="field">
        <span>Title</span>
        <input
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Buttermilk pancakes"
          autoComplete="off"
        />
      </label>

      <section className="field">
        <span className="field-label">Ingredients</span>
        <ul className="rows">
          {rows.map((row, index) => (
            <li key={index} className="row">
              <div className="row-inputs">
                <input
                  className="amount"
                  aria-label={`Amount for ingredient ${index + 1}`}
                  value={row.amountText}
                  onChange={(e) => setAmount(index, e.target.value)}
                  onBlur={() => normalizeAmount(index)}
                  placeholder="1 1/2"
                  inputMode="text"
                  autoComplete="off"
                />
                <input
                  className="unit"
                  aria-label={`Unit for ingredient ${index + 1}`}
                  list="known-units"
                  value={row.unit}
                  onChange={(e) => setRows((c) => updateRow(c, index, { unit: e.target.value }))}
                  placeholder="cup"
                  autoComplete="off"
                />
                <input
                  className="name"
                  aria-label={`Name for ingredient ${index + 1}`}
                  value={row.name}
                  onChange={(e) => setRows((c) => updateRow(c, index, { name: e.target.value }))}
                  placeholder="flour"
                  autoComplete="off"
                />
              </div>
              <div className="row-inputs">
                <input
                  className="note"
                  aria-label={`Note for ingredient ${index + 1}`}
                  value={row.note}
                  onChange={(e) => setRows((c) => updateRow(c, index, { note: e.target.value }))}
                  placeholder="sifted, room temperature…"
                  autoComplete="off"
                />
                <div className="row-actions">
                  <button
                    type="button"
                    aria-label={`Move ingredient ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => setRows((c) => moveRow(c, index, index - 1))}
                  >↑</button>
                  <button
                    type="button"
                    aria-label={`Move ingredient ${index + 1} down`}
                    disabled={index === rows.length - 1}
                    onClick={() => setRows((c) => moveRow(c, index, index + 1))}
                  >↓</button>
                  <button
                    type="button"
                    aria-label={`Remove ingredient ${index + 1}`}
                    onClick={() => setRows((c) => removeRow(c, index, emptyRow))}
                  >✕</button>
                  <button
                    type="button"
                    aria-label={`Add ingredient after ${index + 1}`}
                    onClick={() => setRows((c) => addRow(c, index, emptyRow))}
                  >+</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ghost wide"
          onClick={() => setRows((c) => addRow(c, undefined, emptyRow))}
        >
          Add ingredient
        </button>
        <datalist id="known-units">
          {units.map((unit) => <option key={unit} value={unit} />)}
        </datalist>
      </section>

      <label className="field">
        <span>Instructions</span>
        <textarea
          rows={12}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Whisk the dry ingredients…"
        />
      </label>
    </form>
  );
}
