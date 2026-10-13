import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { db } from '../lib/db';
import { RecipeStore } from '../lib/store';
import { listVersions } from '../lib/repository';

function renderApp() {
  const store = new RecipeStore();
  const user = userEvent.setup();
  render(<App store={store} />);
  return { store, user };
}

async function addRecipe(
  user: ReturnType<typeof userEvent.setup>,
  { title, amount = '1 1/2', unit = 'cup', name = 'flour', step = 'Mix it.' }:
    { title: string; amount?: string; unit?: string; name?: string; step?: string },
) {
  await user.click(await screen.findByRole('button', { name: 'New' }));
  const fill = async (label: string, value: string) => {
    if (value) await user.type(screen.getByLabelText(label), value);
  };
  await fill('Title', title);
  await fill('Amount for ingredient 1', amount);
  await fill('Unit for ingredient 1', unit);
  await fill('Name for ingredient 1', name);
  await fill('Step 1', step);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByRole('heading', { name: title, level: 1 });
}

beforeEach(async () => {
  await db.recipes.clear();
  await db.versions.clear();
  await db.drafts.clear();
});

describe('recipe list', () => {
  it('shows an empty state before anything is added', async () => {
    renderApp();
    expect(await screen.findByText(/No recipes yet/i)).toBeInTheDocument();
  });

  it('lists a saved recipe after going back', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByRole('button', { name: /Pancakes/ })).toBeInTheDocument();
  });
});

describe('creating and reading a recipe', () => {
  it('stores what was typed and renders it back', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes', amount: '1 1/2', unit: 'cup', name: 'flour' });

    expect(screen.getByText('1 1/2 cup')).toBeInTheDocument();
    expect(screen.getByText('flour')).toBeInTheDocument();
    expect(screen.getByText('Mix it.')).toBeInTheDocument();
  });

  it('persists the amount as a number parsed from the fraction', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes', amount: '1 1/2' });

    const [recipe] = await db.recipes.toArray();
    expect(recipe.ingredients[0].amount).toBe(1.5);
  });

  it('keeps an amount null when it is not a number', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Soup', amount: '', name: 'salt' });

    const [recipe] = await db.recipes.toArray();
    expect(recipe.ingredients[0].amount).toBeNull();
  });

  it('normalizes a decimal amount to a fraction on blur', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'New' }));
    const amount = screen.getByLabelText('Amount for ingredient 1');
    await user.type(amount, '0.5');
    await user.tab();

    expect(amount).toHaveValue('1/2');
  });
});

describe('ingredient rows', () => {
  it('adds, fills, reorders and removes rows', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'New' }));

    await user.type(screen.getByLabelText('Name for ingredient 1'), 'flour');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    await user.type(screen.getByLabelText('Name for ingredient 2'), 'sugar');

    await user.click(screen.getByRole('button', { name: 'Move ingredient 2 up' }));
    expect(screen.getByLabelText('Name for ingredient 1')).toHaveValue('sugar');
    expect(screen.getByLabelText('Name for ingredient 2')).toHaveValue('flour');

    await user.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
    expect(screen.getByLabelText('Name for ingredient 1')).toHaveValue('flour');
    expect(screen.queryByLabelText('Name for ingredient 2')).not.toBeInTheDocument();
  });

  it('inserts a row directly after a given one', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'New' }));

    await user.type(screen.getByLabelText('Name for ingredient 1'), 'first');
    await user.click(screen.getByRole('button', { name: 'Add ingredient' }));
    await user.type(screen.getByLabelText('Name for ingredient 2'), 'third');

    await user.click(screen.getByRole('button', { name: 'Add ingredient after 1' }));
    await user.type(screen.getByLabelText('Name for ingredient 2'), 'second');

    expect(screen.getByLabelText('Name for ingredient 3')).toHaveValue('third');
  });

  it('cannot move the first row up or the last row down', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'New' }));
    expect(screen.getByRole('button', { name: 'Move ingredient 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move ingredient 1 down' })).toBeDisabled();
  });

  it('offers already-used units in the datalist', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes', unit: 'tbsp' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'New' }));

    await waitFor(() => {
      expect(document.querySelector('#known-units option[value="tbsp"]')).toBeTruthy();
    });
  });
});

describe('steps', () => {
  it('adds, reorders and removes steps, and saves them in order', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'New' }));
    await user.type(screen.getByLabelText('Title'), 'Pancakes');

    await user.type(screen.getByLabelText('Step 1'), 'Fry.');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.type(screen.getByLabelText('Step 2'), 'Whisk.');
    await user.click(screen.getByRole('button', { name: 'Add step' }));
    await user.type(screen.getByLabelText('Step 3'), 'Discard me.');

    await user.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(screen.getByLabelText('Step 1')).toHaveValue('Whisk.');
    expect(screen.getByLabelText('Step 2')).toHaveValue('Fry.');

    await user.click(screen.getByRole('button', { name: 'Remove step 3' }));
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Pancakes', level: 1 });

    const [recipe] = await db.recipes.toArray();
    expect(recipe.steps).toEqual(['Whisk.', 'Fry.']);
  });

  it('renders steps as a numbered list', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes', step: 'Whisk.' });

    const list = screen.getByRole('list', { name: 'Steps' });
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Whisk.']);
  });

  it('drops blank steps and shows a recipe without any', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Toast', step: '' });

    const [recipe] = await db.recipes.toArray();
    expect(recipe.steps).toEqual([]);
    expect(screen.getByText('None written.')).toBeInTheDocument();
  });

  it('loads saved steps back into the editor', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes', step: 'Whisk.' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('Step 1')).toHaveValue('Whisk.');
  });
});

describe('search', () => {
  it('filters the list by title, ingredient and step text', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes', name: 'flour', step: 'Whisk well.' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await addRecipe(user, { title: 'Tomato Soup', name: 'tomato', step: 'Simmer.' });
    await user.click(screen.getByRole('button', { name: 'Back' }));

    const search = screen.getByLabelText('Search recipes');

    await user.type(search, 'tomato');
    expect(screen.queryByRole('button', { name: /Pancakes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tomato Soup/ })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'whisk');
    expect(screen.getByRole('button', { name: /Pancakes/ })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'pancaks');
    expect(screen.getByRole('button', { name: /Pancakes/ })).toBeInTheDocument();
  });

  it('shows a no-match message', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await user.type(screen.getByLabelText('Search recipes'), 'zzzqqq');
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
});

describe('editing', () => {
  it('saves a change and shows the new text', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Crepes');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Crepes', level: 1 })).toBeInTheDocument();
  });

  it('records the previous state in history on every save', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Crepes');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Crepes', level: 1 });

    const [recipe] = await db.recipes.toArray();
    const versions = await listVersions(recipe.id);
    expect(versions.map((v) => v.snapshot.title)).toEqual(['Pancakes']);
  });

  it('titles an untitled recipe rather than saving a blank name', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'New' }));
    await user.type(screen.getByLabelText('Name for ingredient 1'), 'mystery');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Untitled', level: 1 })).toBeInTheDocument();
  });
});

describe('history and revert', () => {
  it('lists versions and restores one', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Original' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Changed');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Changed', level: 1 });

    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByText('Original')).toBeInTheDocument();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Revert' }));

    expect(await screen.findByRole('heading', { name: 'Original', level: 1 })).toBeInTheDocument();
  });

  it('expands a version to show its ingredients', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Original', name: 'oldflour' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Name for ingredient 1'));
    await user.type(screen.getByLabelText('Name for ingredient 1'), 'newflour');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('newflour');

    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(await screen.findByRole('button', { name: /Original/ }));

    expect(await screen.findByText('oldflour')).toBeInTheDocument();
  });

  it('says so when there is no history yet', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });
    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findByText(/No earlier versions yet/)).toBeInTheDocument();
  });
});

describe('deleting', () => {
  it('removes the recipe after confirmation', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Doomed' });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete recipe' }));

    expect(await screen.findByText(/No recipes yet/)).toBeInTheDocument();
    expect(await db.recipes.count()).toBe(0);
  });

  it('keeps the recipe when the confirmation is dismissed', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Spared' });

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: 'Delete recipe' }));

    expect(await db.recipes.count()).toBe(1);
  });
});

describe('drafts', () => {
  it('restores an autosaved draft when the editor reopens', async () => {
    const { user, store } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });
    const [recipe] = await db.recipes.toArray();

    await db.drafts.put({
      recipeId: recipe.id,
      recipe: { ...recipe, title: 'Half-typed change' },
      savedAt: Date.now(),
    });
    await store.refresh();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText(/Restored your unsaved changes/)).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Half-typed change');
  });

  it('discards the draft once the edit is saved', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Title'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Pancakes!', level: 1 });

    await waitFor(async () => expect(await db.drafts.count()).toBe(0));
  });

  it('discards the draft when the edit is cancelled', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Title'), ' changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByRole('heading', { name: 'Pancakes', level: 1 });

    await waitFor(async () => expect(await db.drafts.count()).toBe(0));
  });
});

describe('backup', () => {
  it('imports a backup file and shows its recipes', async () => {
    const { user } = renderApp();
    const backup = {
      format: 'recipe-manager-backup',
      version: 1,
      exportedAt: Date.now(),
      recipes: [{
        id: 'imported-1',
        title: 'Imported Stew',
        ingredients: [{ amount: 2, unit: 'kg', name: 'beef', note: '' }],
        steps: ['Brown the beef.', 'Braise low.'],
        createdAt: 1,
        updatedAt: 2,
      }],
      versions: [],
    };

    await user.click(await screen.findByRole('button', { name: 'Backup' }));
    await user.upload(
      screen.getByLabelText('Backup file to import'),
      new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }),
    );

    expect(await screen.findByText(/Imported 1 recipe and 0 earlier versions/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: /Imported Stew/ })).toBeInTheDocument();
  });

  it('reports a file that is not a backup', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Backup' }));
    await user.upload(
      screen.getByLabelText('Backup file to import'),
      new File(['nonsense'], 'oops.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/i);
  });

  it('exports a download containing the recipes', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Exportable' });
    await user.click(screen.getByRole('button', { name: 'Back' }));

    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob);
      return 'blob:stub';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: 'Backup' }));
    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    await screen.findByText('Backup downloaded.');
    expect(JSON.parse(await created[0].text()).recipes[0].title).toBe('Exportable');
  });
});

describe('navigation', () => {
  it('goes list → recipe → history → recipe → list', async () => {
    const { user } = renderApp();
    await addRecipe(user, { title: 'Pancakes' });

    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Pancakes', level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
  });

  it('cancelling a new recipe returns to the list without saving', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'New' }));
    await user.type(screen.getByLabelText('Title'), 'Abandoned');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    expect(await db.recipes.count()).toBe(0);
  });
});
