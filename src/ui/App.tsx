import { useEffect, useState } from 'react';
import { requestPersistence } from '../lib/db';
import { RecipeStore } from '../lib/store';
import { BackupPanel } from './BackupPanel';
import { RecipeEditor } from './RecipeEditor';
import { RecipeList } from './RecipeList';
import { RecipeView } from './RecipeView';
import { VersionHistory } from './VersionHistory';

type Screen =
  | { name: 'list' }
  | { name: 'view'; id: string }
  | { name: 'edit'; id: string | null }
  | { name: 'history'; id: string }
  | { name: 'backup' };

export function App({ store }: { store: RecipeStore }) {
  const [screen, setScreen] = useState<Screen>({ name: 'list' });

  useEffect(() => {
    void store.load();
    void requestPersistence();
  }, [store]);

  switch (screen.name) {
    case 'edit':
      return (
        <RecipeEditor
          store={store}
          recipeId={screen.id}
          onSaved={(recipe) => setScreen({ name: 'view', id: recipe.id })}
          onCancel={() =>
            setScreen(screen.id ? { name: 'view', id: screen.id } : { name: 'list' })
          }
        />
      );
    case 'view':
      return (
        <RecipeView
          store={store}
          recipeId={screen.id}
          onEdit={() => setScreen({ name: 'edit', id: screen.id })}
          onHistory={() => setScreen({ name: 'history', id: screen.id })}
          onBack={() => setScreen({ name: 'list' })}
        />
      );
    case 'history':
      return (
        <VersionHistory
          store={store}
          recipeId={screen.id}
          onBack={() => setScreen({ name: 'view', id: screen.id })}
        />
      );
    case 'backup':
      return <BackupPanel store={store} onBack={() => setScreen({ name: 'list' })} />;
    default:
      return (
        <RecipeList
          store={store}
          onOpen={(id) => setScreen({ name: 'view', id })}
          onNew={() => setScreen({ name: 'edit', id: null })}
          onBackup={() => setScreen({ name: 'backup' })}
        />
      );
  }
}
