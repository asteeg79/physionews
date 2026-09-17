/**
 * Relevance-Pipeline — orchestriert die Bewertung neuer News-Items
 * auf ihre Physiotherapie-Relevanz (Score 0-10).
 *
 * Hybrid-Architektur:
 *  1. Keyword-Scoring (deterministisch, kostenfrei) → scoreByKeywords()
 *  2. Grauzonen-Items → Gemini Flash mit klarem Bewertungs-Rubric
 *  3. Items mit Score &lt; MIN_RELEVANCE_THRESHOLD (4) werden gelöscht
 *
 * Token-Budget: typisch 800-4500 Tokens/Lauf (&lt; 1% vom Free-Tier).
 *
 * Läuft in GitHub Actions (scripts/pipeline/classify.ts): die Items werden
 * einmal geladen, im Speicher bewertet und einmal zurückgeschrieben.
 *
 * @see ./keywords.ts für Schlagwortlisten und Source-Bias
 * @see ./gemini.ts für AI-Klassifizierung
 */
import type { NewsItem, RelevanceMethod } from '@/data/types';
import { loadNews, saveNews } from '@/data/news';
import { listSources } from '@/data/sources';
import { scoreByKeywords } from './keywords';
import { classifyBatch, estimateTokens, GEMINI_QUOTA_EXHAUSTED, type GeminiInput } from './gemini';
import { getQuotaStatus, recordUsage } from './gemini-quota';
import { getCachedByHashes, setCachedBulk, titleHash } from './gemini-cache';

/** Batch-Größe für Gemini — passt sicher in 4096 maxOutputTokens. */
const GEMINI_BATCH_SIZE = 20;

/**
 * Sleep zwischen Gemini-Batches innerhalb desselben Laufs.
 * Free-Tier-RPM-Limit für gemini-2.5-flash-lite ist 30/min — mit 2,5 s
 * Pause halten wir uns bei max. ~24 RPM, sicherer Abstand. So vermeiden
 * wir 429er auch bei größeren Backlogs.
 */
const INTER_BATCH_DELAY_MS = 2_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mindest-Relevanz, unter der Items komplett verworfen werden. */
export const MIN_RELEVANCE_THRESHOLD = 4;

interface ScoreCandidate {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  sourceName: string;
  sourceCategory: string;
}

/** Ein berechnetes Ergebnis, das noch auf das Item geschrieben werden muss. */
interface ClassificationUpdate {
  id: string;
  score: number;
  reason: string;
  method: RelevanceMethod;
  topics: string[];
}

interface PipelineResult {
  total: number;
  byMethod: { keyword: number; ai: number };
  byDecision: { accept: number; reject: number; gray: number };
  geminiTokensEstimated: number;
  geminiBatches: number;
  geminiFailures: number;
  deletedBelowThreshold: number;
  /** Anzahl Items, die per Cache-Hit klassifiziert wurden (kein API-Call). */
  cacheHits: number;
  /** True, wenn das Tages-Quota-Limit gebremst hat. */
  quotaThrottled: boolean;
}

/**
 * Bewertet eine Liste von Kandidaten per Hybrid-Pipeline:
 *  1. scoreByKeywords für alle Items
 *  2. accept/reject stehen damit fest
 *  3. gray-Items gehen batch-weise an Gemini
 *  4. Bei Gemini-Fail oder fehlendem Key: Keyword-Score bleibt
 *
 * Schreibt nichts — liefert die Ergebnisse, die der Aufrufer anwendet.
 */
async function classifyCandidates(items: ScoreCandidate[]): Promise<{
  result: PipelineResult;
  updates: ClassificationUpdate[];
  /** IDs, die wegen Quota-Limit unbewertet blieben und `pending` bleiben. */
  skipped: Set<string>;
}> {
  const result: PipelineResult = {
    total: items.length,
    byMethod: { keyword: 0, ai: 0 },
    byDecision: { accept: 0, reject: 0, gray: 0 },
    geminiTokensEstimated: 0,
    geminiBatches: 0,
    geminiFailures: 0,
    deletedBelowThreshold: 0,
    cacheHits: 0,
    quotaThrottled: false,
  };

  const updates: ClassificationUpdate[] = [];
  const skippedDueToQuota = new Set<string>();

  if (items.length === 0) return { result, updates, skipped: skippedDueToQuota };

  const grayPool: GeminiInput[] = [];

  // Stufe 1: Keyword-Scoring
  for (const item of items) {
    const scored = scoreByKeywords({
      title: item.title,
      summary: item.summary,
      sourceName: item.sourceName,
      sourceCategory: item.sourceCategory,
    });

    result.byDecision[scored.decision]++;

    if (scored.decision === 'gray') {
      grayPool.push({ id: item.id, title: item.title, sourceName: item.sourceName });
    }

    // Keyword-Score vorab festhalten, falls Gemini nichts liefert.
    updates.push({
      id: item.id,
      score: scored.score,
      reason: `keyword (${scored.decision}): ${scored.reason}`,
      method: 'keyword',
      topics: [], // Topics setzt erst Gemini
    });
  }

  // Stufe 2: Gemini auf Grauzone (mit Quota-Check und Result-Cache)
  if (grayPool.length > 0 && process.env.GEMINI_API_KEY) {
    const aiResults = await classifyGrayPool(grayPool, result, skippedDueToQuota);

    // AI-Ergebnisse (Cache + frisch) in die Updates einarbeiten
    for (const upd of updates) {
      const ai = aiResults.get(upd.id);
      if (ai) {
        upd.score = ai.score;
        upd.reason = `ai: ${ai.reason}`;
        upd.method = 'ai';
        upd.topics = ai.topics;
      }
    }
  }

  for (const upd of updates) {
    if (skippedDueToQuota.has(upd.id)) continue;
    if (upd.method === 'ai') result.byMethod.ai++;
    else result.byMethod.keyword++;
  }

  return { result, updates, skipped: skippedDueToQuota };
}

/** Ein von Gemini (oder aus dem Cache) geliefertes Ergebnis. */
interface AiResult {
  score: number;
  reason: string;
  topics: string[];
}

/**
 * Bewertet die Grauzonen-Items per Gemini: erst Cache-Treffer einsammeln,
 * dann — sofern das Tagesbudget es hergibt — den Rest in Batches anfragen.
 *
 * Aktualisiert die Zähler in `result` und trägt Items, die wegen erschöpfter
 * Quota unbewertet blieben, in `skipped` ein.
 */
async function classifyGrayPool(
  grayPool: GeminiInput[],
  result: PipelineResult,
  skipped: Set<string>
): Promise<Map<string, AiResult>> {
  const aiResults = new Map<string, AiResult>();

  // 2a. Cache-Lookup: Titel, die wir bereits klassifiziert haben
  const grayHashes = grayPool.map((g) => ({ ...g, h: titleHash(g.title) }));
  const cache = await getCachedByHashes(grayHashes.map((g) => g.h));
  const stillUnclassified: GeminiInput[] = [];
  for (const g of grayHashes) {
    const hit = cache.get(g.h);
    if (hit) {
      aiResults.set(g.id, { score: hit.score, reason: hit.reason, topics: hit.topics });
      result.cacheHits++;
    } else {
      stillUnclassified.push({ id: g.id, title: g.title, sourceName: g.sourceName });
    }
  }

  if (stillUnclassified.length === 0) return aiResults;

  // 2b. Quota prüfen
  const quota = await getQuotaStatus();
  if (!quota.canUseAi) {
    result.quotaThrottled = true;
    console.warn(
      `[Pipeline] Gemini-Quota erreicht (${quota.tokensUsed}/${quota.tokensUsed + quota.tokensRemaining} Tokens) ` +
        `— ${stillUnclassified.length} Items bleiben bei Keyword-Score.`
    );
    return aiResults;
  }

  // 2c./2d. API-Calls für die restlichen Items, Ergebnisse cachen
  await runGeminiBatches(stillUnclassified, aiResults, result, skipped);
  return aiResults;
}

/**
 * Schickt die offenen Items batchweise an Gemini und trägt die Ergebnisse in
 * `aiResults` ein. Bricht bei erschöpfter Quota ab und markiert die dann noch
 * offenen Items in `skipped`, damit sie `pending` bleiben.
 */
async function runGeminiBatches(
  items: GeminiInput[],
  aiResults: Map<string, AiResult>,
  result: PipelineResult,
  skipped: Set<string>
): Promise<void> {
  const newCacheEntries: Array<Parameters<typeof setCachedBulk>[0][number]> = [];
  const titleHashes = new Map(items.map((u) => [u.id, titleHash(u.title)]));

  for (let i = 0; i < items.length; i += GEMINI_BATCH_SIZE) {
    const batch = items.slice(i, i + GEMINI_BATCH_SIZE);
    result.geminiBatches++;
    const tokens = estimateTokens(batch);
    result.geminiTokensEstimated += tokens;

    // Per-Minute-Throttle: zwischen Batches kurze Pause, damit wir nicht ins
    // RPM-Limit (30/min für free tier) rauschen. Erster Batch läuft sofort,
    // ab dem zweiten warten wir.
    if (i > 0) await sleep(INTER_BATCH_DELAY_MS);

    const batchResults = await classifyBatch(batch);

    if (batchResults === GEMINI_QUOTA_EXHAUSTED) {
      // 429 — Quota erschöpft. Der fehlgeschlagene Call zählt bei Google
      // trotzdem gegen RPM/RPD, bei uns als Request ohne Tokens.
      await recordUsage(0, 1);
      result.quotaThrottled = true;
      for (let j = i; j < items.length; j++) skipped.add(items[j].id);
      console.warn(
        `[Pipeline] Gemini-Quota erschöpft (HTTP 429) — ${skipped.size} Items bleiben pending.`
      );
      break;
    }

    if (!batchResults) {
      // 5xx/Timeout/Parse-Fehler: Call ging trotzdem raus, zählt bei Google.
      await recordUsage(0, 1);
      result.geminiFailures++;
      continue;
    }

    await recordUsage(tokens, 1);
    for (const r of batchResults) {
      aiResults.set(r.id, { score: r.score, reason: r.reason, topics: r.topics });
      const h = titleHashes.get(r.id);
      if (h) {
        newCacheEntries.push({ titleHash: h, score: r.score, topics: r.topics, reason: r.reason });
      }
    }
  }

  if (newCacheEntries.length > 0) {
    await setCachedBulk(newCacheEntries);
  }
}

/**
 * Holt die noch nicht klassifizierten Items (`relevanceMethod === 'pending'`),
 * bewertet sie und schreibt `data/news.json` einmal zurück.
 *
 * Items unter dem Schwellwert werden dabei gelöscht — off-topic-Einträge
 * sollen gar nicht erst in der Datei stehen bleiben.
 *
 * @param limit Maximale Items pro Aufruf.
 */
export async function classifyPendingItems(
  limit = 500
): Promise<PipelineResult & { remaining: number }> {
  const news = await loadNews();
  const sources = await listSources();
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const pending = news.filter((n) => n.relevanceMethod === 'pending');
  const batch = pending.slice(0, limit);

  const candidates: ScoreCandidate[] = batch.map((item) => {
    const source = sourceById.get(item.sourceId);
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      url: item.url,
      sourceName: source?.name ?? '',
      sourceCategory: source?.category ?? '',
    };
  });

  const { result, updates, skipped } = await classifyCandidates(candidates);

  // Ergebnisse anwenden
  const byId = new Map(news.map((n) => [n.id, n]));
  const dropIds = new Set<string>();
  for (const upd of updates) {
    if (skipped.has(upd.id)) continue;
    const item = byId.get(upd.id);
    if (!item) continue;
    item.relevanceScore = upd.score;
    item.relevanceMethod = upd.method;
    item.relevanceReason = upd.reason;
    item.topics = upd.topics;
    if (upd.score < MIN_RELEVANCE_THRESHOLD) dropIds.add(upd.id);
  }

  const kept = dropIds.size > 0 ? news.filter((n) => !dropIds.has(n.id)) : news;
  result.deletedBelowThreshold = dropIds.size;

  await saveNews(kept, 'chore(data): News klassifiziert');

  const remaining = kept.filter((n) => n.relevanceMethod === 'pending').length;
  return { ...result, remaining };
}

/** Löscht alle bestehenden Items mit Score &lt; MIN_RELEVANCE_THRESHOLD. */
export async function purgeBelowThreshold(): Promise<number> {
  const news = await loadNews();
  const kept = news.filter((n) => n.relevanceScore >= MIN_RELEVANCE_THRESHOLD);
  const removed = news.length - kept.length;
  if (removed > 0) {
    await saveNews(kept, 'chore(data): irrelevante News entfernt');
  }
  return removed;
}

/** Setzt alle Items auf `pending` zurück — für eine komplette Neubewertung. */
export async function resetAllToPending(): Promise<number> {
  const news = await loadNews();
  for (const item of news) {
    item.relevanceMethod = 'pending';
  }
  await saveNews(news, 'chore(data): Klassifizierung zurückgesetzt');
  return news.length;
}

/** Verteilung Score/Methode — für die Ausgabe der Wartungsskripte. */
export async function relevanceStats(): Promise<
  Array<{ score: number; method: RelevanceMethod; count: number }>
> {
  const news: NewsItem[] = await loadNews();
  const buckets = new Map<string, { score: number; method: RelevanceMethod; count: number }>();
  for (const item of news) {
    const key = `${item.relevanceScore}|${item.relevanceMethod}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.count++;
    else buckets.set(key, { score: item.relevanceScore, method: item.relevanceMethod, count: 1 });
  }
  return [...buckets.values()].sort(
    (a, b) => b.score - a.score || a.method.localeCompare(b.method)
  );
}
