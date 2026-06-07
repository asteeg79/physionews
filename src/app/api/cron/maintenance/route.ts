/**
 * Cron-Endpoint: Aufräumen + Top-News-Auswahl.
 *
 * Aufgaben:
 *  - Items, deren publishedAt älter als retentionDays ist, löschen
 *  - lastGlobalRefreshAt aktualisieren
 *  - AI-Top-News-Auswahl (selectAndPersistTopNews)
 *
 * Läuft als 3. und letzter Schritt nach fetch und classify.
 */

import { db, schema } from '@/db';
import { and, desc, eq, lte, ne, notInArray, or, sql as drizzleSql } from 'drizzle-orm';
import { selectAndPersistTopNews } from '@/lib/relevance/top-news';
import { checkCronSecret } from '@/lib/cron-auth';
import { checkWindow } from '@/lib/cron-window';
import { isHighlightedSourceName, HIGHLIGHTED_SOURCE_KEEP } from '@/lib/highlighted-sources';

export const maxDuration = 60;

export async function POST(req: Request) {
  const authFail = checkCronSecret(req);
  if (authFail) return authFail;

  const win = await checkWindow();
  if (!win) {
    return Response.json({ error: 'App-Einstellungen fehlen' }, { status: 500 });
  }
  // Maintenance läuft auch außerhalb des Fensters, damit Retention gewährleistet ist —
  // wir entscheiden bewusst gegen einen Outside-Window-Skip hier.

  // 1a. Retention: alte Items löschen.
  // AUSNAHME: hervorgehobene Quellen (RA Alt, physiotherapeuten.de, …)
  // publizieren sporadisch — bei 30 Tagen Retention würden ihre Items sofort
  // wieder verschwinden. Wir ermitteln deren Source-IDs einmal und schließen
  // sie vom DELETE aus. Storage-Volumen ist vernachlässigbar (~4 Quellen
  // × wenige Items/Monat).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - win.settings.retentionDays);

  const allSources = await db
    .select({ id: schema.sources.id, name: schema.sources.name })
    .from(schema.sources);
  const protectedIds = allSources
    .filter((s) => isHighlightedSourceName(s.name))
    .map((s) => s.id);

  const retentionConditions = [lte(schema.newsItems.publishedAt, cutoff)];
  if (protectedIds.length > 0) {
    retentionConditions.push(notInArray(schema.newsItems.sourceId, protectedIds));
  }
  const deletedOld = await db
    .delete(schema.newsItems)
    .where(and(...retentionConditions))
    .returning({ id: schema.newsItems.id });
  if (protectedIds.length > 0) {
    console.log(
      `[Cron:Maintenance] Retention-Schutz für ${protectedIds.length} hervorgehobene Quellen aktiv`
    );
  }

  // 1c. Pro hervorgehobener Quelle nur die N neuesten Items behalten.
  // Verhindert, dass Lieblingsquellen die Liste dominieren — sie sind
  // zwar vom 30-Tage-Cutoff ausgenommen, aber nicht von der Mengen-
  // begrenzung. Bei N=5 pro Quelle bleibt die Liste übersichtlich.
  let highlightedTrimmed = 0;
  for (const srcId of protectedIds) {
    // Subselect: IDs der N+1-ten und älteren Items dieser Quelle.
    const stale = await db
      .select({ id: schema.newsItems.id })
      .from(schema.newsItems)
      .where(eq(schema.newsItems.sourceId, srcId))
      .orderBy(desc(schema.newsItems.publishedAt))
      .offset(HIGHLIGHTED_SOURCE_KEEP);
    if (stale.length === 0) continue;
    await db
      .delete(schema.newsItems)
      .where(drizzleSql`${schema.newsItems.id} = ANY(${stale.map((r) => r.id)}::text[])`);
    highlightedTrimmed += stale.length;
  }
  if (highlightedTrimmed > 0) {
    console.log(
      `[Cron:Maintenance] ${highlightedTrimmed} alte Items aus hervorgehobenen Quellen gestutzt (max ${HIGHLIGHTED_SOURCE_KEEP} pro Quelle)`
    );
  }

  // 1b. Nicht-deutsche Items löschen — Frontend filtert sie ohnehin aus,
  //     hier sparen wir uns Speicher und Klassifizierungs-Tokens.
  const deletedLang = await db
    .delete(schema.newsItems)
    .where(ne(schema.newsItems.lang, 'de'))
    .returning({ id: schema.newsItems.id });

  console.log(
    `[Cron:Maintenance] ${deletedOld.length} alte + ${deletedLang.length} nicht-deutsche Items gelöscht`
  );
  void or; // potentiell für künftige OR-Filter

  // 2. lastGlobalRefreshAt aktualisieren
  await db
    .update(schema.appSettings)
    .set({ lastGlobalRefreshAt: new Date() })
    .where(eq(schema.appSettings.id, 1));

  // 3. AI-Top-News-Auswahl (nach Cleanup, damit nur Items innerhalb der
  //    Retention markiert werden)
  let topNewsInfo: { selected: number; usedAi: boolean; pool: number; tokens: number } = {
    selected: 0,
    usedAi: false,
    pool: 0,
    tokens: 0,
  };
  try {
    const tn = await selectAndPersistTopNews();
    topNewsInfo = {
      selected: tn.selectedIds.length,
      usedAi: tn.usedAi,
      pool: tn.poolSize,
      tokens: tn.tokensEstimated,
    };
    console.log(
      `[Cron:Maintenance] Top-News: ${tn.selectedIds.length} aus Pool von ${tn.poolSize} ` +
        `(usedAi=${tn.usedAi}, ~${tn.tokensEstimated} Tokens)`
    );
  } catch (err) {
    console.error('[Cron:Maintenance] Top-News-Auswahl fehlgeschlagen:', err);
  }

  return Response.json({
    ok: true,
    deletedOldItems: deletedOld.length,
    deletedNonGermanItems: deletedLang.length,
    topNews: topNewsInfo,
    berlinHour: win.berlinHour,
  });
}
