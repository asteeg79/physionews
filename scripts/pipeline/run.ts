/**
 * Die komplette Datenpflege — läuft in GitHub Actions, schreibt die Dateien
 * in `data/` und wird vom Workflow anschließend committet.
 *
 *   npx tsx scripts/pipeline/run.ts [fetch|classify|maintenance|all]
 *
 * Ersetzt die früheren Cron-Endpoints (/api/cron/fetch, /classify,
 * /maintenance, /refresh). Die Aufteilung in vier HTTP-Aufrufe gab es nur
 * wegen des 60-Sekunden-Timeouts von Vercel-Functions — hier läuft alles
 * in einem Prozess, ohne Chunking-Loop im Workflow-YAML und ohne Cron-Secret.
 *
 * Stufen:
 *   1. fetch        Quellen abrufen, neue Items anhängen
 *   2. classify     Keyword- und KI-Bewertung, Push für Score >= 9
 *   3. maintenance  Retention, Top-News-Auswahl, Cache-Pflege
 *
 * Das Refresh-Fenster aus `data/settings.json` gilt für die geplanten
 * Läufe. Ein manuell ausgelöster Lauf (`workflow_dispatch`, also auch der
 * Refresh-Knopf in der App) läuft immer.
 */
import { config } from 'dotenv';

// Lokal kommen die Keys aus .env.local; in GitHub Actions gibt es die
// Datei nicht und die Werte stehen bereits in der Umgebung.
config({ path: '.env.local' });

import { checkWindow } from '../../src/lib/cron-window';
import { fetchAllSources } from '../../src/lib/feed-fetcher';
import { classifyPendingItems } from '../../src/lib/relevance';
import { selectAndPersistTopNews } from '../../src/lib/relevance/top-news';
import { pruneCache } from '../../src/lib/relevance/gemini-cache';
import { notifyNewHighRelevanceItems } from '../../src/lib/push-sender';
import { loadNews, saveNews } from '../../src/data/news';
import { listSources } from '../../src/data/sources';
import { getSettings, updateSettings } from '../../src/data/settings';
import {
  isHighlightedSourceName,
  HIGHLIGHTED_SOURCE_KEEP,
} from '../../src/lib/highlighted-sources';

/** Mindest-Score für eine eigene Push-Benachrichtigung. */
const PUSH_RELEVANCE_THRESHOLD = 9;

/** Items pro Klassifizierungs-Runde — hält die Gemini-Batches überschaubar. */
const CLASSIFY_CHUNK = 100;

/** Sicherheitsdeckel, damit ein großer Rückstand den Lauf nicht sprengt. */
const MAX_CLASSIFY_ROUNDS = 12;

/** Cache-Einträge, die älter sind, fliegen bei der Wartung raus. */
const CACHE_RETENTION_DAYS = 30;

type Stage = 'fetch' | 'classify' | 'maintenance' | 'all';

async function stageFetch(): Promise<void> {
  console.log('\n── 1. Quellen abrufen ──');
  const { results, totalNew } = await fetchAllSources();
  const failed = results.filter((r) => r.error);

  console.log(`${totalNew} neue Items aus ${results.length} Quellen.`);
  for (const r of failed) {
    console.warn(`::warning::Quelle "${r.sourceName}": ${r.error}`);
  }
}

async function stageClassify(): Promise<void> {
  console.log('\n── 2. Klassifizieren ──');
  const settings = await getSettings();

  let round = 0;
  while (round < MAX_CLASSIFY_ROUNDS) {
    round++;
    const result = await classifyPendingItems(CLASSIFY_CHUNK);
    if (result.total === 0) {
      console.log('Keine offenen Items mehr.');
      break;
    }

    console.log(
      `Runde ${round}: ${result.total} bewertet ` +
        `(keyword: ${result.byMethod.keyword}, ai: ${result.byMethod.ai}, ` +
        `Cache-Treffer: ${result.cacheHits}, gelöscht: ${result.deletedBelowThreshold}, ` +
        `Gemini-Batches: ${result.geminiBatches}, ~${result.geminiTokensEstimated} Tokens, ` +
        `offen: ${result.remaining})`
    );

    if (result.quotaThrottled) {
      console.log(
        '::notice::Gemini-Quota erschöpft — die restlichen Items kommen im nächsten Lauf dran.'
      );
      break;
    }
    if (result.remaining === 0) break;
  }

  // Push für hochrelevante, noch nie notifizierte Items.
  const notify = await notifyNewHighRelevanceItems({
    threshold: PUSH_RELEVANCE_THRESHOLD,
    notificationsEnabled: settings.notificationsEnabled,
  });
  console.log(
    `Push: ${notify.pushSent} gesendet (${notify.itemsConsidered} Kandidaten, ` +
      `Schwellwert >= ${PUSH_RELEVANCE_THRESHOLD}).`
  );
}

async function stageMaintenance(): Promise<void> {
  console.log('\n── 3. Aufräumen + Top-News ──');
  const settings = await getSettings();
  const sources = await listSources();
  const news = await loadNews();

  // Hervorgehobene Quellen (RA Alt, physiotherapeuten.de, …) publizieren
  // sporadisch. Bei 30 Tagen Retention wären ihre Beiträge sofort wieder
  // weg — deshalb sind sie vom Datums-Cutoff ausgenommen und werden
  // stattdessen auf die N neuesten Items pro Quelle begrenzt.
  const protectedIds = new Set(
    sources.filter((s) => isHighlightedSourceName(s.name)).map((s) => s.id)
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - settings.retentionDays);

  let deletedOld = 0;
  let deletedLang = 0;
  const kept = news.filter((item) => {
    // Nicht-deutsche Items blendet das Frontend ohnehin aus — hier sparen
    // wir uns Speicher und Klassifizierungs-Tokens.
    if (item.lang !== 'de') {
      deletedLang++;
      return false;
    }
    if (!protectedIds.has(item.sourceId) && item.publishedAt <= cutoff) {
      deletedOld++;
      return false;
    }
    return true;
  });

  // Mengenbegrenzung für die hervorgehobenen Quellen.
  let highlightedTrimmed = 0;
  const perHighlightedSource = new Map<string, number>();
  const trimmed = kept
    .slice()
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .filter((item) => {
      if (!protectedIds.has(item.sourceId)) return true;
      const seen = (perHighlightedSource.get(item.sourceId) ?? 0) + 1;
      perHighlightedSource.set(item.sourceId, seen);
      if (seen > HIGHLIGHTED_SOURCE_KEEP) {
        highlightedTrimmed++;
        return false;
      }
      return true;
    });

  await saveNews(trimmed, 'chore(data): News aufgeräumt');
  console.log(
    `${deletedOld} alte + ${deletedLang} nicht-deutsche Items gelöscht, ` +
      `${highlightedTrimmed} aus hervorgehobenen Quellen gestutzt ` +
      `(max ${HIGHLIGHTED_SOURCE_KEEP} pro Quelle). Verbleibend: ${trimmed.length}.`
  );

  const prunedCache = await pruneCache(CACHE_RETENTION_DAYS);
  if (prunedCache > 0) console.log(`${prunedCache} alte Gemini-Cache-Einträge entfernt.`);

  await updateSettings({ lastGlobalRefreshAt: new Date() });

  // Top-News erst nach dem Aufräumen wählen, damit nur Items innerhalb der
  // Retention markiert werden.
  try {
    const top = await selectAndPersistTopNews();
    console.log(
      `Top-News: ${top.selectedIds.length} aus einem Pool von ${top.poolSize} ` +
        `(KI: ${top.usedAi}, ~${top.tokensEstimated} Tokens).`
    );
  } catch (err) {
    console.error('::warning::Top-News-Auswahl fehlgeschlagen:', err);
  }
}

async function main(): Promise<void> {
  const stage = (process.argv[2] ?? 'all') as Stage;

  // Geplante Läufe respektieren das Refresh-Fenster; ein manuell
  // angestoßener Lauf (auch über den Knopf in der App) läuft immer.
  const manual = process.env.GITHUB_EVENT_NAME !== 'schedule';
  const win = await checkWindow();
  if (!manual && !win.inWindow) {
    console.log(
      `Außerhalb des Refresh-Fensters (${win.berlinHour}h Berlin, Fenster ` +
        `${win.settings.refreshWindowStart}–${win.settings.refreshWindowEnd}h) — nichts zu tun.`
    );
    return;
  }

  console.log(`PhysioNews-Pipeline — Stufe "${stage}", ${win.berlinHour}h Berlin.`);

  if (stage === 'fetch' || stage === 'all') await stageFetch();
  if (stage === 'classify' || stage === 'all') await stageClassify();
  if (stage === 'maintenance' || stage === 'all') await stageMaintenance();

  console.log('\nPipeline abgeschlossen.');
}

main().catch((err) => {
  console.error('Pipeline fehlgeschlagen:', err);
  process.exit(1);
});
