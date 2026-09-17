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
 * Aufruf: Als letzte Stufe jedes Pipeline-Laufs. Die Auswahl wird im Feld
 * `isTopNews` in `data/news.json` festgehalten (vorher alle zurücksetzen).
 *
 * Token-Budget: Pro Auswahl ~1000 Tokens (1× pro Lauf alle 2h).
 */

import type { NewsItem } from '@/data/types';
import { loadNews, saveNews } from '@/data/news';
import { listSources } from '@/data/sources';
import { getQuotaStatus, recordUsage } from './gemini-quota';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Wartezeiten vor den Wiederholungen nach einem 429 (ms). Zwei Versuche
 * reichen, um die Minutengrenze zu überbrücken; danach greift der
 * Score-Fallback.
 */
const RETRY_DELAYS_MS = [8_000, 20_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Macht fremden Text für eine Log-Zeile unschädlich: Steuerzeichen und
 * Zeilenumbrüche raus, damit eine API-Antwort keine zusätzlichen Log-Einträge
 * vortäuschen kann, und auf eine vernünftige Länge gekürzt.
 */
function sanitizeForLog(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 200);
}

/**
 * Zieht die aussagekräftige Meldung aus einer Fehlerantwort der Gemini-API.
 * Vorher wurde nur der Statuscode geloggt — damit ließ sich nicht
 * unterscheiden, ob das Minutenlimit, das Tagesbudget oder ein fehlerhafter
 * Request die Ursache war.
 */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.text();
    const parsed = JSON.parse(body) as { error?: { status?: string; message?: string } };
    const err = parsed.error;
    if (err?.message) {
      return sanitizeForLog(`${err.status ?? res.status}: ${err.message}`);
    }
    return sanitizeForLog(body);
  } catch {
    return sanitizeForLog(res.statusText || String(res.status));
  }
}

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
  const news = await loadNews();

  // 1. Kandidaten-Pool bilden: hochrelevante Items, nach Score+Datum sortiert
  const pool = await buildCandidatePool(news);

  if (pool.length === 0) {
    await persistFlags(news, []);
    return { selectedIds: [], usedAi: false, poolSize: 0, tokensEstimated: 0 };
  }

  // 2. Bei sehr kleiner Liste: nimm einfach alle bzw. die Top-N
  if (pool.length <= TOP_N) {
    const ids = pool.map((p) => p.id);
    await persistFlags(news, ids);
    return { selectedIds: ids, usedAi: false, poolSize: pool.length, tokensEstimated: 0 };
  }

  // 3. AI-Auswahl
  const ai = await selectByAi(pool);
  let selectedIds = ai?.ids ?? null;

  // 4. Fallback bei AI-Fail: diversifizierte Score-Auswahl
  // Statt 3 Items derselben Quelle wählen wir je ein Item pro Quelle
  // (in Score-Reihenfolge), bis wir TOP_N voll haben — dann fülle mit dem Rest auf.
  let usedAi = true;
  if (!selectedIds || selectedIds.length === 0) {
    selectedIds = pickDiverseByScore(pool, TOP_N);
    usedAi = false;
  }

  // 5. Persist
  await persistFlags(news, selectedIds);

  return {
    selectedIds,
    usedAi,
    poolSize: pool.length,
    tokensEstimated: ai?.tokensEstimated ?? 0,
  };
}

/**
 * Bildet den Kandidaten-Pool: score >= MIN, sortiert primär nach Score DESC,
 * sekundär nach Datum DESC, gekappt auf POOL_SIZE.
 *
 * Ob ein Item schon gelesen wurde, spielt keine Rolle — die Top-News sind
 * eine kuratierte Übersicht über das aktuell Wichtigste, unabhängig vom
 * Lesestand eines einzelnen Geräts.
 */
async function buildCandidatePool(news: NewsItem[]): Promise<CandidateItem[]> {
  const sources = await listSources();
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  return news
    .filter((n) => n.relevanceScore >= MIN_SCORE_FOR_POOL && sourceById.has(n.sourceId))
    .sort(
      (a, b) =>
        b.relevanceScore - a.relevanceScore ||
        b.publishedAt.getTime() - a.publishedAt.getTime()
    )
    .slice(0, POOL_SIZE)
    .map((n) => {
      const source = sourceById.get(n.sourceId)!;
      return {
        id: n.id,
        title: n.title,
        relevanceScore: n.relevanceScore,
        publishedAt: n.publishedAt,
        sourceName: source.name,
        category: source.category as string,
      };
    });
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

  // Erst das Tagesbudget prüfen: ohne verbleibende Anfragen wäre der Call
  // ein garantierter 429 — der bei Google trotzdem zählt.
  const quota = await getQuotaStatus();
  if (!quota.canUseAiForTopNews) {
    console.warn(
      `[TopNews-AI] Tagesbudget aufgebraucht (${quota.requestsMade} Anfragen) — Score-Sortierung.`
    );
    return null;
  }

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

  // Geschätzte Tokens (4 chars/token Faustregel) — schon hier ermitteln,
  // damit auch failed/empty Calls als Request gegen die Tagesquota zählen.
  const charsTotal = SYSTEM_PROMPT.length + userInput.length;
  const tokensEstimated = Math.ceil(charsTotal / 4);

  try {
    // Ein 429 heißt hier fast immer „zu viele Anfragen pro Minute", nicht
    // „Tagesbudget aufgebraucht": die Klassifizierung feuert unmittelbar
    // davor bis zu 15 Anfragen, und dieser Aufruf fällt oft noch in
    // dieselbe Minute. Kurz warten und erneut versuchen genügt meistens.
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        // Auch fehlgeschlagene Calls zählen bei Google gegen RPM/RPD —
        // wir verbuchen den Request ohne Tokens (keine Antwort erhalten).
        await recordUsage(0, 1);
        const detail = await errorDetail(res);

        if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
          const wait = RETRY_DELAYS_MS[attempt];
          console.warn(
            `[TopNews-AI] HTTP 429 (${detail}) — neuer Versuch in ${wait / 1000}s …`
          );
          await sleep(wait);
          continue;
        }

        console.warn(`[TopNews-AI] HTTP ${res.status}: ${detail}`);
        return null;
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.warn('[TopNews-AI] Antwort ohne verwertbaren Text.');
        await recordUsage(tokensEstimated, 1);
        return null;
      }

      const parsed = JSON.parse(text) as string[];
      // Sanity: alle IDs müssen aus dem Pool stammen
      const validIds = new Set(pool.map((p) => p.id));
      const filtered = parsed.filter((id) => validIds.has(id));
      await recordUsage(tokensEstimated, 1);

      if (filtered.length === 0) {
        console.warn('[TopNews-AI] Keine der gelieferten IDs stammt aus dem Pool.');
        return null;
      }
      return { ids: filtered.slice(0, TOP_N), tokensEstimated };
    }
  } catch (err) {
    console.warn('[TopNews-AI] Fehler:', err);
    // Timeout/Netzwerk-Fehler: Call ist trotzdem rausgegangen.
    await recordUsage(0, 1);
    return null;
  }
}

/**
 * Diversifizierter Score-Fallback: nimmt zunächst je 1 Item pro Source
 * in Score-Reihenfolge. Wenn nach diesem Durchgang noch nicht TOP_N
 * Items zusammen sind, wird mit den höchstgescorten Resten aufgefüllt.
 * Verhindert "3× dasselbe Magazin" als Top-News.
 */
function pickDiverseByScore(pool: CandidateItem[], n: number): string[] {
  // Pool ist bereits nach Score DESC, pubDate DESC sortiert
  const seenSources = new Set<string>();
  const firstPass: string[] = [];
  for (const item of pool) {
    if (firstPass.length >= n) break;
    if (seenSources.has(item.sourceName)) continue;
    seenSources.add(item.sourceName);
    firstPass.push(item.id);
  }
  if (firstPass.length >= n) return firstPass;

  // Auffüllen mit den nächsten höchstgescorten Items (auch wenn Source wiederholt)
  const selectedSet = new Set(firstPass);
  for (const item of pool) {
    if (firstPass.length >= n) break;
    if (selectedSet.has(item.id)) continue;
    firstPass.push(item.id);
    selectedSet.add(item.id);
  }
  return firstPass;
}

/**
 * Schreibt die Auswahl zurück: alle Flags zurücksetzen, dann die gewählten
 * Items markieren und die Datei einmal speichern.
 */
async function persistFlags(news: NewsItem[], ids: string[]): Promise<void> {
  const selected = new Set(ids);
  for (const item of news) {
    item.isTopNews = selected.has(item.id);
  }
  await saveNews(news, 'chore(data): Top-News-Auswahl aktualisiert');
}
