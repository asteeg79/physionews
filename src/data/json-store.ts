/**
 * Lesen und Schreiben der JSON-Dateien in `data/`.
 *
 * Gelesen wird immer vom lokalen Dateisystem: auf Vercel liegen die
 * Dateien im Deployment-Bundle (siehe `outputFileTracingIncludes` in
 * next.config.ts), in GitHub Actions im ausgecheckten Repo. Da sich die
 * Dateien innerhalb eines Deployments nie ändern, wird der geparste
 * Inhalt pro Prozess gecacht.
 *
 * Geschrieben wird je nach Umgebung unterschiedlich:
 *  - `fs`     — lokal und in GitHub Actions: atomar (tmp-Datei + rename)
 *  - `github` — auf Vercel: Commit über die Contents-API
 *
 * Die Wahl trifft `writeMode()`; mit `DATA_WRITE_MODE` lässt sie sich
 * erzwingen.
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { putRepoFile } from './github';

/** Verzeichnis der Datendateien, relativ zum Projekt-Root. */
export const DATA_DIR = path.join(process.cwd(), 'data');

/** Pfad der Datendateien im Repo — wird für die Commit-Message gebraucht. */
const REPO_DATA_DIR = 'data';

/** Pro Prozess gecachte, bereits geparste Dateiinhalte. */
const cache = new Map<string, unknown>();

export type WriteMode = 'fs' | 'github';

/**
 * `fs` überall außer auf Vercel. Dort ist das Dateisystem read-only,
 * deshalb geht jede Änderung als Commit ins Repo.
 */
export function writeMode(): WriteMode {
  const forced = process.env.DATA_WRITE_MODE;
  if (forced === 'fs' || forced === 'github') return forced;
  return process.env.VERCEL ? 'github' : 'fs';
}

/**
 * Liest eine Datendatei. Fehlt sie oder ist sie unlesbar, wird `fallback`
 * geliefert — die App startet damit auch ohne vorhandene Daten.
 */
export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const cached = cache.get(fileName);
  if (cached !== undefined) return cached as T;

  let parsed: T;
  try {
    const raw = await readFile(path.join(DATA_DIR, fileName), 'utf-8');
    parsed = JSON.parse(raw) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.warn(`[JsonStore] ${fileName} konnte nicht gelesen werden:`, err);
    }
    parsed = fallback;
  }

  cache.set(fileName, parsed);
  return parsed;
}

/**
 * Schreibt eine Datendatei und aktualisiert den Prozess-Cache.
 *
 * @param message Commit-Message für den `github`-Modus.
 */
export async function writeJson<T>(
  fileName: string,
  value: T,
  message = `chore(data): ${fileName} aktualisiert`
): Promise<void> {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  if (writeMode() === 'github') {
    await putRepoFile(`${REPO_DATA_DIR}/${fileName}`, serialized, message);
  } else {
    const target = path.join(DATA_DIR, fileName);
    const tmp = `${target}.${process.pid}.tmp`;
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(tmp, serialized, 'utf-8');
    // rename ist auf demselben Dateisystem atomar — ein abgebrochener
    // Schreibvorgang kann die bestehende Datei damit nicht beschädigen.
    await rename(tmp, target);
  }

  cache.set(fileName, value);
}

/**
 * Verwirft den Cache. Nötig in lang laufenden Prozessen (Pipeline-Skripte,
 * Tests), die eine Datei schreiben und danach frisch lesen wollen.
 */
export function clearCache(fileName?: string): void {
  if (fileName) cache.delete(fileName);
  else cache.clear();
}

/** ISO-String aus der Datei → `Date`. Leere Werte bleiben `null`. */
export function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

/** Wie `toDate`, aber für Pflichtfelder — fällt auf die Epoche zurück. */
export function toRequiredDate(value: string | null | undefined): Date {
  return value ? new Date(value) : new Date(0);
}
