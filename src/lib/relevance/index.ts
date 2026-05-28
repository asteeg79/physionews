import { db, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { scoreByKeywords } from './keywords';
import { classifyBatch, estimateTokens, type GeminiInput } from './gemini';

const GEMINI_BATCH_SIZE = 30;

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
  };

  if (items.length === 0) return result;

  const grayPool: GeminiInput[] = [];
  const updates: Array<{
    id: string;
    score: number;
    reason: string;
    method: 'keyword' | 'ai' | 'pending';
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
      });
    } else {
      updates.push({
        id: item.id,
        score: scored.score,
        reason: `keyword (${scored.decision}): ${scored.reason}`,
        method: 'keyword',
      });
    }
  }

  // Stufe 2: Gemini auf Grauzone
  if (grayPool.length > 0 && process.env.GEMINI_API_KEY) {
    const aiResults = new Map<string, { score: number; reason: string }>();
    for (let i = 0; i < grayPool.length; i += GEMINI_BATCH_SIZE) {
      const batch = grayPool.slice(i, i + GEMINI_BATCH_SIZE);
      result.geminiBatches++;
      result.geminiTokensEstimated += estimateTokens(batch);
      const batchResults = await classifyBatch(batch);
      if (!batchResults) {
        result.geminiFailures++;
        continue;
      }
      for (const r of batchResults) {
        aiResults.set(r.id, { score: r.score, reason: r.reason });
      }
    }

    // AI-Ergebnisse in updates einarbeiten
    for (const upd of updates) {
      const ai = aiResults.get(upd.id);
      if (ai) {
        upd.score = ai.score;
        upd.reason = `ai: ${ai.reason}`;
        upd.method = 'ai';
      }
    }
  }

  // Stufe 3: Bulk-Update — pro Item ein einzelnes UPDATE.
  // Bei < 100 Items akzeptabel; bei mehr wäre eine CASE/WHEN-Variante schneller.
  for (const upd of updates) {
    await db
      .update(schema.newsItems)
      .set({
        relevanceScore: upd.score,
        relevanceMethod: upd.method,
        relevanceReason: upd.reason,
      })
      .where(eq(schema.newsItems.id, upd.id));

    if (upd.method === 'ai') result.byMethod.ai++;
    else result.byMethod.keyword++;
  }

  return result;
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
