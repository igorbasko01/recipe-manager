import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftAutosave, useStoreState } from './hooks';
import { db } from '../lib/db';
import { RecipeStore } from '../lib/store';
import { createRecipe, getDraft } from '../lib/repository';
import type { Recipe } from '../lib/types';

function sample(title: string): Recipe {
  return { ...createRecipe(), title };
}

beforeEach(async () => {
  await db.recipes.clear();
  await db.drafts.clear();
  // Fake only the debounce timer: fake-indexeddb schedules its transactions on
  // setImmediate, and faking that deadlocks every database call.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useStoreState', () => {
  it('re-renders when the store changes', async () => {
    vi.useRealTimers();
    const store = new RecipeStore();
    const { result } = renderHook(() => useStoreState(store));

    expect(result.current.loading).toBe(true);
    await act(async () => { await store.load(); });
    expect(result.current.loading).toBe(false);
  });
});

describe('useDraftAutosave', () => {
  it('does not write before the debounce elapses', async () => {
    const recipe = sample('typing');
    renderHook(() => useDraftAutosave(recipe, true, 500));

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(await getDraft(recipe.id)).toBeUndefined();
  });

  it('writes the draft once the debounce elapses', async () => {
    const recipe = sample('typing');
    renderHook(() => useDraftAutosave(recipe, true, 500));

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect((await getDraft(recipe.id))!.recipe.title).toBe('typing');
  });

  it('restarts the timer on each change, saving only the latest value', async () => {
    const recipe = sample('one');
    const { rerender } = renderHook(({ r }) => useDraftAutosave(r, true, 500), {
      initialProps: { r: recipe },
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    rerender({ r: { ...recipe, title: 'two' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(await getDraft(recipe.id)).toBeUndefined();

    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect((await getDraft(recipe.id))!.recipe.title).toBe('two');
  });

  it('writes nothing when disabled', async () => {
    const recipe = sample('typing');
    renderHook(() => useDraftAutosave(recipe, false, 500));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(await getDraft(recipe.id)).toBeUndefined();
  });

  it('flushes immediately when the tab is hidden', async () => {
    const recipe = sample('unsaved');
    renderHook(() => useDraftAutosave(recipe, true, 5000));

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    await vi.waitFor(async () => {
      expect((await getDraft(recipe.id))!.recipe.title).toBe('unsaved');
    });
  });
});
