import { useCallback, useEffect, useState } from 'react';
import type { RecipeStore } from '../lib/store';
import type { RecipeVersion } from '../lib/types';
import { RecipeBody } from './RecipeView';

function when(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface Props {
  store: RecipeStore;
  recipeId: string;
  onBack: () => void;
}

export function VersionHistory({ store, recipeId, onBack }: Props) {
  const [versions, setVersions] = useState<RecipeVersion[] | null>(null);
  const [openAt, setOpenAt] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setVersions(await store.versions(recipeId));
  }, [store, recipeId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleRevert(timestamp: number) {
    if (!window.confirm('Revert to this version? The current text is kept in history.')) return;
    await store.revert(recipeId, timestamp);
    setOpenAt(null);
    await reload();
    onBack();
  }

  return (
    <div className="history">
      <header className="bar">
        <button type="button" className="ghost" onClick={onBack}>Back</button>
        <h2>History</h2>
        <span className="bar-spacer" />
      </header>

      {versions === null ? (
        <p className="empty">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="empty">No earlier versions yet. Each save records one.</p>
      ) : (
        <ul className="versions">
          {versions.map((version) => (
            <li key={version.timestamp}>
              <div className="version-head">
                <button
                  type="button"
                  className="version-toggle"
                  aria-expanded={openAt === version.timestamp}
                  onClick={() =>
                    setOpenAt(openAt === version.timestamp ? null : version.timestamp)
                  }
                >
                  <span className="version-when">{when(version.timestamp)}</span>
                  <span className="version-title">{version.snapshot.title || 'Untitled'}</span>
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => handleRevert(version.timestamp)}
                >
                  Revert
                </button>
              </div>
              {openAt === version.timestamp && (
                <div className="version-body">
                  <RecipeBody recipe={version.snapshot} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
