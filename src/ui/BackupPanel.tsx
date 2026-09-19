import { useRef, useState } from 'react';
import { backupFilename, exportBackup, importBackup, parseBackup, serializeBackup } from '../lib/backup';
import type { RecipeStore } from '../lib/store';

interface Props {
  store: RecipeStore;
  onBack: () => void;
}

export function BackupPanel({ store, onBack }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setError(null);
    const json = serializeBackup(await exportBackup());
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFilename();
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Backup downloaded.');
  }

  async function handleImport(file: File) {
    setMessage(null);
    setError(null);
    try {
      const result = await importBackup(parseBackup(await file.text()));
      await store.refresh();
      setMessage(
        `Imported ${result.recipes} recipe${result.recipes === 1 ? '' : 's'} ` +
        `and ${result.versions} earlier version${result.versions === 1 ? '' : 's'}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That import failed.');
    }
  }

  return (
    <div className="backup">
      <header className="bar">
        <button type="button" className="ghost" onClick={onBack}>Back</button>
        <h2>Backup</h2>
        <span className="bar-spacer" />
      </header>

      <p className="prose">
        Everything lives on this device. Export a JSON file — recipes and their full
        version history — to keep a copy somewhere else.
      </p>

      <div className="backup-actions">
        <button type="button" className="primary wide" onClick={handleExport}>
          Export JSON
        </button>
        <button type="button" className="ghost wide" onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Backup file to import"
          className="file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />
      </div>

      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <p className="prose muted">
        Importing merges into what is already here. A recipe with the same id is
        replaced by the imported copy.
      </p>
    </div>
  );
}
