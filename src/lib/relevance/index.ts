/**
 * Relevance-Pipeline — orchestriert die Bewertung neuer News-Items
 * auf ihre Physiotherapie-Relevanz (Score 0-10).
 *
 * Hybrid-Architektur:
 *  1. Keyword-Scoring (deterministisch, kostenfrei) → scoreByKeywords()
 *  2. Grauzonen-Items → Gemini Flash mit klarem Bewertungs-Rubric
 *  3. Items mit Score &lt; MIN_RELEVANCE_THRESHOLD (4) werden gelöscht
 *
 * Token-Budget: typisch 800-4500 Tokens/Cron (&lt; 1% vom Free-Tier).
 *
 * @see ./keywords.ts für Schlagwortlisten und Source-Bias
 * @see ./gemini.ts für AI-Klassifizierung
 */
import { db, schema } from '@/db';
import { eq, lt, sql } from 'drizzle-orm';
import { scoreByKeywords } from './keywords';
import { classifyBatch, estimateTokens, type GeminiInput } from './gemini';
import { getQuotaStatus, recordUsage } from './gemini-quota';
import { getCachedByHashes, setCachedBulk, titleHash } from './gemini-cache';

/** Batch-Größe für Gemini — passt sicher in 4096 maxOutputTokens. */
const GEMINI_BATCH_SIZE = 20;

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
 * Klassifiziert eine Liste von News-Items per Hybrid-Pipeline:
 *  1. scoreByKeywords für alle Items
 *  2. accept/reject werden sofort gespeichert
 *  3. gray-Items werden batch-weise an Gemini geschickt
 *  4. Bei Gemini-Fail oder fehlendem Key: keyword-Score bleibt
 */
export async function classifyNewItems(items: ScoreCandidate[]): Promise<PipelineResult> {
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

  if (items.length === 0) return result;

  const grayPool: GeminiInput[] = [];
  const updates: Array<{
    id: string;
    score: number;
    reason: string;
    method: 'keyword' | 'ai' | 'pending';
    topics: string[];
  }> = [];

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
      // Vorab den Keyword-Score persistieren, falls Gemini fehlschlägt
      updates.push({
        id: item.id,
        score: scored.score,
        reason: `keyword (gray): ${scored.reason}`,
        method: 'keyword',
        topics: [], // erst durch Gemini gesetzt
      });
    } else {
      updates.push({
        id: item.id,
        score: scored.score,
        reason: `keyword (${scored.decision}): ${scored.reason}`,
        method: 'keyword',
        topics: [],
      });
    }
  }

  // Stufe 2: Gemini auf Grauzone (mit Quota-Check und Result-Cache)
  if (grayPool.length > 0 && process.env.GEMINI_API_KEY) {
    const aiResults = new Map<string, { score: number; reason: string; topics: string[] }>();

    // 2a. Cache-Lookup: titles, die wir bereits klassifiziert haben
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

    // 2b. Quota prüfen
    const quota = await getQuotaStatus();
    if (!quota.canUseAi && stillUnclassified.length > 0) {
      result.quotaThrottled = true;
      console.warn(
        `[Pipeline] Gemini-Quota erreicht (${quota.tokensUsed}/${quota.tokensUsed + quota.tokensRemaining} Tokens) ` +
          `— ${stillUnclassified.length} Items bleiben bei Keyword-Score.`
      );
    } else if (stillUnclassified.length > 0) {
      // 2c. API-Calls nur für nicht-gecachte Items
      const newCacheEntries: Array<Parameters<typeof setCachedBulk>[0][number]> = [];
      const titleHashes = new Map(stillUnclassified.map((u) => [u.id, titleHash(u.title)]));

      for (let i = 0; i < stillUnclassified.length; i += GEMINI_BATCH_SIZE) {
        const batch = stillUnclassified.slice(i, i + GEMINI_BATCH_SIZE);
        result.geminiBatches++;
        const tokens = estimateTokens(batch);
        result.geminiTokensEstimated += tokens;

        const batchResults = await classifyBatch(batch);
        if (!batchResults) {
          result.geminiFailures++;
          continue;
        }
        await recordUsage(tokens, 1);

        for (const r of batchResults) {
          aiResults.set(r.id, { score: r.score, reason: r.reason, topics: r.topics });
          const h = titleHashes.get(r.id);
          if (h) {
            newCacheEntries.push({
              titleHash: h,
              score: r.score,
              topics: r.topics,
              reason: r.reason,
            });
          }
        }
      }
      // 2d. Neue Cache-Einträge persistieren
      if (newCacheEntries.length > 0) {
        await setCachedBulk(newCacheEntries);
      }
    }

    // AI-Ergebnisse (Cache + fresh) in updates einarbeiten
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

  // Stufe 3: Bulk-Update — pro Item ein einzelnes UPDATE.
  for (const upd of updates) {
    await db
      .update(schema.newsItems)
      .set({
        relevanceScore: upd.score,
        relevanceMethod: upd.method,
        relevanceReason: upd.reason,
        topics: upd.topics,
      })
      .where(eq(schema.newsItems.id, upd.id));

    if (upd.method === 'ai') result.byMethod.ai++;
    else result.byMethod.keyword++;
  }

  // Stufe 4: Items unter dem Schwellwert komplett löschen.
  // (Der Nutzer will keine off-topic-Items in der DB; spart Speicher und
  // hält die Liste sauber.)
  const idsToDelete = updates
    .filter((upd) => upd.score < MIN_RELEVANCE_THRESHOLD)
    .map((upd) => upd.id);
  if (idsToDelete.length > 0) {
    // ON CONFLICT-Vermeidung: einzeln löschen ist langsamer aber sicher
    for (const id of idsToDelete) {
      await db.delete(schema.newsItems).where(eq(schema.newsItems.id, id));
    }
    result.deletedBelowThreshold = idsToDelete.length;
  }

  return result;
}

/**
 * Löscht alle bestehenden Items mit Score &lt; threshold (für Cleanup-Skript).
 */
export async function purgeBelowThreshold(): Promise<number> {
  const deleted = await db
    .delete(schema.newsItems)
    .where(lt(schema.newsItems.relevanceScore, MIN_RELEVANCE_THRESHOLD))
    .returning({ id: schema.newsItems.id });
  return deleted.length;
}

/**
 * Holt sich Items, die noch nicht klassifiziert wurden (method='pending')
 * und klassifiziert sie. Wird vom Cron + Skript benutzt.
 */
export async function classifyPendingItems(): Promise<PipelineResult> {
  const items = await db
    .select({
      id: schema.newsItems.id,
      title: schema.newsItems.title,
      summary: schema.newsItems.summary,
      url: schema.newsItems.url,
      sourceName: schema.sources.name,
      sourceCategory: sql<string>`${schema.sources.category}::text`,
    })
    .from(schema.newsItems)
    .innerJoin(schema.sources, eq(schema.newsItems.sourceId, schema.sources.id))
    .where(eq(schema.newsItems.relevanceMethod, 'pending'))
    .limit(500);

  return classifyNewItems(
    items.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      url: row.url,
      sourceName: row.sourceName,
      sourceCategory: row.sourceCategory,
    }))
  );
}
