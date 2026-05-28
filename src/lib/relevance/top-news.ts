/**
 * Top-News-Selektor — AI-kuratierte Auswahl der 3 wichtigsten News-Items.
 *
 * Problem: Reine Score-Sortierung liefert oft homogene Listen (z.B. 10 VPT-
 * Items mit Score 10). Damit die TopNewsSection echten Mehrwert bietet,
 * lassen wir Gemini aus den top-kandidaten 3 Items auswählen, die zusammen
 * eine ausgewogene Übersicht ergeben:
 *  - Direkte Praxis-Relevanz (Heilmittel, Methoden, Recht)
 *  - Aktualität (jünger bevorzugt)
 *  - Themen-Vielfalt (verschiedene Aspekte, nicht 3x dasselbe Thema)
 *
 * Aufruf: Nach jedem Cron-Refresh. Die Auswahl wird im DB-Flag
 * news_items.is_top_news persistiert (vorher alle is_top_news=false setzen).
 *
 * Token-Budget: Pro Auswahl ~1000 Tokens (1× pro Cron-Lauf alle 2h).
 */

import { db, schema } from '@/db';
import { desc, eq, gte } from 'drizzle-orm';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Anzahl Items, die als Pool an Gemini übergeben werden. */
const POOL_SIZE = 25;
/** Anzahl Items, die als Top-News markiert werden. */
const TOP_N = 3;
/** Mindest-Relevanz, ab der ein Item überhaupt als Top-News-Kandidat in Frage kommt. */
const MIN_SCORE_FOR_POOL = 6;

const SYSTEM_PROMPT = `Du wählst aus einer Kandidatenliste die 3 wichtigsten News-Items für deutsche Physiotherapeut:innen aus.

Bewertungs-Kriterien (in dieser Reihenfolge):
1. DIREKTE Praxis-Relevanz: Heilmittelverordnung, Blankoverordnung, GKV-Vergütung, neue Methoden, klinische Studien zu muskuloskelettal/neurolog. Themen, Reha
2. AKTUALITÄT: Neuere Items bevorzugen (Datum ist Hinweis)
3. THEMEN-VIELFALT: Drei verschiedene Aspekte — NICHT 3 ähnliche Verband-News oder 3 Studien zum gleichen Thema
4. BEDEUTUNG: Themen mit Konsequenzen für den Berufsalltag (Recht, Vergütung) vor reinen Networking/Verwaltungs-Themen

Antworte als JSON-Array mit GENAU 3 String-IDs aus der Eingabe, in absteigender Wichtigkeit sortiert.`;

interface CandidateItem {
  id: string;
  title: string;
  sourceName: string;
  category: string;
  relevanceScore: number;
  publishedAt: Date;
}

export interface TopNewsResult {
  selectedIds: string[];
  /** Wurde Gemini erfolgreich konsultiert? false = Fallback auf Score-DESC */
  usedAi: boolean;
  /** Anzahl Kandidaten, aus denen ausgewählt wurde */
  poolSize: number;
  /** Geschätzter Token-Verbrauch */
  tokensEstimated: number;
}

/**
 * Wählt 3 Top-News aus, persistiert is_top_news in der DB und liefert
 * die gewählten IDs zurück. Setzt vorher alle bisherigen Flags zurück.
 */
export async function selectAndPersistTopNews(): Promise<TopNewsResult> {
  // 1. Kandidaten-Pool holen: hochrelevante, ungelesene Items, nach Score+Datum sortiert
  const pool = await fetchCandidatePool();

  if (pool.length === 0) {
    await clearAllTopNewsFlags();
    return { selectedIds: [], usedAi: false, poolSize: 0, tokensEstimated: 0 };
  }

  // 2. Bei sehr kleiner Liste: nimm einfach alle bzw. die Top-N
  if (pool.length <= TOP_N) {
    const ids = pool.map((p) => p.id);
    await persistFlags(ids);
    return { selectedIds: ids, usedAi: false, poolSize: pool.length, tokensEstimated: 0 };
  }

  // 3. AI-Auswahl
  const ai = await selectByAi(pool);
  let selectedIds = ai?.ids ?? null;

  // 4. Fallback bei AI-Fail: erste TOP_N nach Score
  let usedAi = true;
  if (!selectedIds || selectedIds.length === 0) {
    selectedIds = pool.slice(0, TOP_N).map((p) => p.id);
    usedAi = false;
  }

  // 5. Persist
  await persistFlags(selectedIds);

  return {
    selectedIds,
    usedAi,
    poolSize: pool.length,
    tokensEstimated: ai?.tokensEstimated ?? 0,
  };
}

/**
 * Holt die top-N-Kandidaten aus der DB: score >= MIN, sortiert
 * primär nach Score DESC, sekundär nach Datum DESC.
 *
 * isRead wird NICHT als Filter benutzt — die Top-News-Auswahl
 * ist eine kuratierte Übersicht über das Wichtigste aktuell im System,
 * unabhängig davon ob der Nutzer einzelne Items schon gesehen hat.
 */
async function fetchCandidatePool(): Promise<CandidateItem[]> {
  const rows = await db
    .select({
      id: schema.newsItems.id,
      title: schema.newsItems.title,
      relevanceScore: schema.newsItems.relevanceScore,
      publishedAt: schema.newsItems.publishedAt,
      sourceName: schema.sources.name,
      category: schema.sources.category,
    })
    .from(schema.newsItems)
    .innerJoin(schema.sources, eq(schema.newsItems.sourceId, schema.sources.id))
    .where(gte(schema.newsItems.relevanceScore, MIN_SCORE_FOR_POOL))
    .orderBy(desc(schema.newsItems.relevanceScore), desc(schema.newsItems.publishedAt))
    .limit(POOL_SIZE);

  return rows.map((r) => ({
    ...r,
    category: r.category as string,
  }));
}

/**
 * Fragt Gemini nach der Top-N-Auswahl. Liefert null bei API-Fail (Caller
 * fällt dann auf Score-DESC zurück).
 */
async function selectByAi(
  pool: CandidateItem[]
): Promise<{ ids: string[]; tokensEstimated: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Kompaktes Format pro Item: ID | Quelle | Score | Datum | Titel
  const userInput = pool
    .map(
      (p) =>
        `${p.id} | ${p.sourceName} | s=${p.relevanceScore} | ${p.publishedAt
          .toISOString()
          .slice(0, 10)} | ${p.title}`
    )
    .join('\n');

  const requestBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userInput }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
        items: { type: 'string' },
        minItems: TOP_N,
        maxItems: TOP_N,
      },
      temperature: 0.2,
      maxOutputTokens: 512,
    },
  };

  try {
    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[TopNews-AI] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as string[];
    // Sanity: alle IDs müssen aus dem Pool stammen
    const validIds = new Set(pool.map((p) => p.id));
    const filtered = parsed.filter((id) => validIds.has(id));
    if (filtered.length === 0) return null;

    // Geschätzte Tokens (4 chars/token Faustregel)
    const charsTotal = SYSTEM_PROMPT.length + userInput.length;
    return { ids: filtered.slice(0, TOP_N), tokensEstimated: Math.ceil(charsTotal / 4) };
  } catch (err) {
    console.warn('[TopNews-AI] Fehler:', err);
    return null;
  }
}

/**
 * Setzt alle is_top_news Flags zurück.
 * Wird auch vor jeder neuen Auswahl aufgerufen.
 */
async function clearAllTopNewsFlags(): Promise<void> {
  await db
    .update(schema.newsItems)
    .set({ isTopNews: false })
    .where(eq(schema.newsItems.isTopNews, true));
}

/**
 * Persistiert die gewählten IDs: alle anderen Flags zurücksetzen,
 * dann die neuen Top-Items auf true setzen.
 */
async function persistFlags(ids: string[]): Promise<void> {
  await clearAllTopNewsFlags();
  for (const id of ids) {
    await db
      .update(schema.newsItems)
      .set({ isTopNews: true })
      .where(eq(schema.newsItems.id, id));
  }
}
