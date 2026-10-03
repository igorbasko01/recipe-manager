import { db } from './db';
import type { BackupFile, Recipe, RecipeVersion } from './types';

export const BACKUP_FORMAT = 'recipe-manager-backup';
export const BACKUP_VERSION = 1;

export async function exportBackup(): Promise<BackupFile> {
  const [recipes, versions] = await Promise.all([
    db.recipes.toArray(),
    db.versions.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    recipes,
    versions,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `recipes-${stamp}.json`;
}

/**
 * Turn a backup file's text into a usable BackupFile, or explain why it isn't
 * one. Only the shape needed to avoid corrupting the store is checked here.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  if (!raw || typeof raw !== 'object') throw new Error('That file is not a recipe backup.');
  const candidate = raw as Partial<BackupFile>;
  if (candidate.format !== BACKUP_FORMAT) throw new Error('That file is not a recipe backup.');
  if (typeof candidate.version !== 'number' || candidate.version > BACKUP_VERSION) {
    throw new Error('That backup was written by a newer version of this app.');
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof candidate.exportedAt === 'number' ? candidate.exportedAt : 0,
    recipes: Array.isArray(candidate.recipes) ? candidate.recipes : [],
    versions: Array.isArray(candidate.versions) ? candidate.versions : [],
  };
}

export interface ImportResult {
  recipes: number;
  versions: number;
}

/** Merge a backup into the store; same id means the imported copy wins. */
export async function importBackup(backup: BackupFile): Promise<ImportResult> {
  const recipes = backup.recipes.filter(isRecipe);
  const versions = backup.versions.filter(isVersion);

  await db.transaction('rw', db.recipes, db.versions, async () => {
    if (recipes.length) await db.recipes.bulkPut(recipes);
    if (versions.length) await db.versions.bulkPut(versions);
  });

  return { recipes: recipes.length, versions: versions.length };
}

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const r = value as Recipe;
  return (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    Array.isArray(r.ingredients) &&
    Array.isArray(r.steps) &&
    r.steps.every((step) => typeof step === 'string') &&
    typeof r.createdAt === 'number' &&
    typeof r.updatedAt === 'number'
  );
}

function isVersion(value: unknown): value is RecipeVersion {
  if (!value || typeof value !== 'object') return false;
  const v = value as RecipeVersion;
  return typeof v.recipeId === 'string' && typeof v.timestamp === 'number' && isRecipe(v.snapshot);
}
