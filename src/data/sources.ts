/**
 * News-Quellen — `data/sources.json`.
 *
 * Geschrieben wird die Datei von zwei Seiten:
 *  - GitHub Actions nach jedem Abruf (lastFetchAt / lastSuccessAt / lastError)
 *  - Die App, wenn der Nutzer Quellen anlegt, umbenennt, (de)aktiviert
 *    oder löscht
 *
 * Beide gehen über `saveSources`, das immer die komplette Liste schreibt.
 */

import { randomUUID } from 'node:crypto';
import type { NewsCategory, Source } from './types';
import { readJson, writeJson, toDate, toRequiredDate } from './json-store';

const FILE = 'sources.json';

/** Rohformat in der Datei — Zeitpunkte als ISO-String. */
interface StoredSource {
  id: string;
  name: string;
  url: string;
  adapterType: string;
  category: NewsCategory;
  iconName: string | null;
  isEnabled: boolean;
  notificationsEnabled: boolean;
  lastFetchAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
}

function fromStored(s: StoredSource): Source {
  return {
    ...s,
    iconName: s.iconName ?? null,
    isEnabled: s.isEnabled ?? true,
    notificationsEnabled: s.notificationsEnabled ?? true,
    lastFetchAt: toDate(s.lastFetchAt),
    lastSuccessAt: toDate(s.lastSuccessAt),
    lastError: s.lastError ?? null,
    createdAt: toRequiredDate(s.createdAt),
  };
}

function toStored(s: Source): StoredSource {
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    adapterType: s.adapterType,
    category: s.category,
    iconName: s.iconName,
    isEnabled: s.isEnabled,
    notificationsEnabled: s.notificationsEnabled,
    lastFetchAt: s.lastFetchAt?.toISOString() ?? null,
    lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
    lastError: s.lastError,
    createdAt: s.createdAt.toISOString(),
  };
}

/**
 * Alle Quellen, sortiert nach Kategorie und Name — die Reihenfolge, in der
 * die Quellen-Verwaltung sie anzeigt.
 */
export async function listSources(): Promise<Source[]> {
  const stored = await readJson<StoredSource[]>(FILE, []);
  return stored
    .map(fromStored)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** Nur die aktivierten Quellen — Basis für jeden Abruf. */
export async function listEnabledSources(): Promise<Source[]> {
  return (await listSources()).filter((s) => s.isEnabled);
}

export async function getSource(id: string): Promise<Source | null> {
  return (await listSources()).find((s) => s.id === id) ?? null;
}

/** Schreibt die komplette Quellen-Liste. */
export async function saveSources(sources: Source[], message?: string): Promise<void> {
  await writeJson(
    FILE,
    sources.map(toStored),
    message ?? 'chore(data): Quellen aktualisiert'
  );
}

/** Legt eine neue Quelle an und liefert sie zurück. */
export async function addSource(input: {
  name: string;
  url: string;
  adapterType: string;
  category: NewsCategory;
  iconName?: string | null;
}): Promise<Source> {
  const sources = await listSources();
  const created: Source = {
    id: randomUUID(),
    name: input.name,
    url: input.url,
    adapterType: input.adapterType,
    category: input.category,
    iconName: input.iconName ?? null,
    isEnabled: true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date(),
  };
  await saveSources([...sources, created], `chore(data): Quelle "${created.name}" angelegt`);
  return created;
}

/** Ändert einzelne Felder einer Quelle. `null`, wenn es sie nicht gibt. */
export async function updateSource(
  id: string,
  patch: Partial<Pick<Source, 'name' | 'isEnabled' | 'notificationsEnabled'>>
): Promise<Source | null> {
  const sources = await listSources();
  const index = sources.findIndex((s) => s.id === id);
  if (index === -1) return null;

  const updated: Source = { ...sources[index], ...patch };
  sources[index] = updated;
  await saveSources(sources, `chore(data): Quelle "${updated.name}" geändert`);
  return updated;
}

/** Löscht eine Quelle. `false`, wenn es sie nicht gab. */
export async function deleteSource(id: string): Promise<boolean> {
  const sources = await listSources();
  const remaining = sources.filter((s) => s.id !== id);
  if (remaining.length === sources.length) return false;
  await saveSources(remaining, 'chore(data): Quelle gelöscht');
  return true;
}
