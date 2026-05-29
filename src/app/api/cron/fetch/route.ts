/**
 * Cron-Endpoint: nur Quellen-Fetch.
 *
 * Aufgaben:
 *  - Alle aktiven Quellen parallel (max 4) abrufen
 *  - Items deduplizieren und inserten
 *  - Source-Status updaten (lastFetchAt / lastSuccessAt / lastError)
 *
 * Bewusst KEINE Klassifizierung, Push oder Top-News-Auswahl hier —
 * diese laufen in separaten Endpoints, damit jeder einzeln innerhalb
 * des Vercel-Function-Timeouts (60s) abgeschlossen werden kann.
 *
 * Reihenfolge des kompletten Cron-Workflows (im GitHub-Actions-YAML):
 *  1. POST /api/cron/fetch
 *  2. POST /api/cron/classify
 *  3. POST /api/cron/maintenance
 */

import { fetchAllSources } from '@/lib/feed-fetcher';
import { checkCronSecret } from '@/lib/cron-auth';
import { checkWindow } from '@/lib/cron-window';

export const maxDuration = 60;

export async function POST(req: Request) {
  const authFail = checkCronSecret(req);
  if (authFail) return authFail;

  const win = await checkWindow();
  if (!win) {
    return Response.json({ error: 'App-Einstellungen fehlen' }, { status: 500 });
  }
  if (!win.inWindow) {
    return Response.json({ skipped: true, reason: 'outside_window', berlinHour: win.berlinHour });
  }

  console.log(`[Cron:Fetch] Start (${win.berlinHour}h Berlin)`);
  const { results, totalNew } = await fetchAllSources();

  return Response.json({
    ok: true,
    totalNew,
    sourcesChecked: results.length,
    errors: results.filter((r) => r.error).map((r) => ({ source: r.sourceName, error: r.error })),
  });
}
