import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { RecipeStore, StoreState } from '../lib/store';
import type { Recipe } from '../lib/types';
import { saveDraft } from '../lib/repository';

export function useStoreState(store: RecipeStore): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export const DRAFT_DEBOUNCE_MS = 600;

/**
 * Autosave the edit in progress to IndexedDB, debounced so typing does not
 * thrash the disk, and flushed when the tab is hidden so a backgrounded tab
 * loses nothing.
 */
export function useDraftAutosave(
  recipe: Recipe | null,
  enabled: boolean,
  delay = DRAFT_DEBOUNCE_MS,
): void {
  const latest = useRef<Recipe | null>(recipe);
  latest.current = recipe;

  const flush = useCallback(() => {
    if (enabled && latest.current) void saveDraft(latest.current);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !recipe) return;
    const timer = setTimeout(flush, delay);
    return () => clearTimeout(timer);
  }, [recipe, enabled, delay, flush]);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
  }, [enabled, flush]);
}
