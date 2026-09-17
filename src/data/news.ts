/**
 * News-Items — `data/news.json`.
 *
 * Geschrieben wird die Datei ausschließlich von der Pipeline in GitHub
 * Actions (Abruf, Klassifizierung, Aufräumen) sowie vom „Cache leeren"-
 * Knopf in den Einstellungen. Die App liest sie nur.
 *
 * Die Pipeline arbeitet auf dem geladenen Array im Speicher und schreibt
 * einmal pro Stufe zurück — deshalb `loadNews()` / `saveNews()` statt
 * einzelner Schreiboperationen pro Item.
 */

import type { NewsItem, NewsItemWithSource, RelevanceMethod, SourceLight } from './types';
import { readJson, writeJson, toDate, toRequiredDate } from './json-store';
import { listSources } from './sources';

const FILE = 'news.json';

/**
 * Voreingestellte Mindest-Relevanz für die Anzeige. In den Einstellungen
 * überschreibbar (`settings.minRelevance`), diese Konstante ist nur der
 * Rückfallwert.
 *
 * Bewusst höher als die Lösch-Schwelle (MIN_RELEVANCE_THRESHOLD = 4): der
 * Bewertungsmaßstab in lib/relevance/gemini.ts nennt 4–6 „nur mittelbarer
 * Bezug". Solche Items bleiben gespeichert — damit sich die Schwelle ohne
 * erneutes Abrufen nachjustieren lässt — werden aber nicht angezeigt.
 */
export const MIN_RELEVANCE = 7;

/**
 * Voreingestellte Höchstzahl Items je Quelle. In den Einstellungen
 * überschreibbar (`settings.maxItemsPerSource`).
 *
 * Ohne Deckel bestimmt schlicht die Publikationsfrequenz das Bild: eine
 * fleißige Quelle stellte zuletzt 14 von 34 sichtbaren Meldungen. Der Deckel
 * greift beim Ausliefern, nicht beim Löschen — er lässt sich damit ohne
 * erneuten Abruf verstellen.
 */
export const MAX_ITEMS_PER_SOURCE = 8;

/** Rohformat in der Datei — Zeitpunkte als ISO-String. */
interface StoredNewsItem {
  id: string;
  sourceId: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  fetchedAt: string;
  notifiedAt: string | null;
  relevanceScore: number;
  relevanceMethod: RelevanceMethod;
  relevanceReason: string | null;
  isTopNews: boolean;
  topics: string[];
  lang: string;
}

function fromStored(n: StoredNewsItem): NewsItem {
  return {
    id: n.id,
    sourceId: n.sourceId,
    title: n.title,
    summary: n.summary ?? null,
    url: n.url,
    imageUrl: n.imageUrl ?? null,
    publishedAt: toRequiredDate(n.publishedAt),
    fetchedAt: toRequiredDate(n.fetchedAt),
    notifiedAt: toDate(n.notifiedAt),
    relevanceScore: n.relevanceScore ?? 5,
    relevanceMethod: n.relevanceMethod ?? 'pending',
    relevanceReason: n.relevanceReason ?? null,
    isTopNews: n.isTopNews ?? false,
    topics: n.topics ?? [],
    lang: n.lang ?? 'de',
  };
}

function toStored(n: NewsItem): StoredNewsItem {
  return {
    id: n.id,
    sourceId: n.sourceId,
    title: n.title,
    summary: n.summary,
    url: n.url,
    imageUrl: n.imageUrl,
    publishedAt: n.publishedAt.toISOString(),
    fetchedAt: n.fetchedAt.toISOString(),
    notifiedAt: n.notifiedAt?.toISOString() ?? null,
    relevanceScore: n.relevanceScore,
    relevanceMethod: n.relevanceMethod,
    relevanceReason: n.relevanceReason,
    isTopNews: n.isTopNews,
    topics: n.topics,
    lang: n.lang,
  };
}

/** Alle Items, unsortiert und ungefiltert. */
export async function loadNews(): Promise<NewsItem[]> {
  const stored = await readJson<StoredNewsItem[]>(FILE, []);
  return stored.map(fromStored);
}

/** Schreibt die komplette Item-Liste. */
export async function saveNews(items: NewsItem[], message?: string): Promise<void> {
  await writeJson(FILE, items.map(toStored), message ?? 'chore(data): News aktualisiert');
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  return (await loadNews()).find((n) => n.id === id) ?? null;
}

export interface NewsQuery {
  category?: string;
  since?: Date;
  topNewsOnly?: boolean;
  /** Volltext über Titel und Zusammenfassung. */
  search?: string;
  /** Genau dieses Themen-Tag. */
  tag?: string;
  /** Nur Items mit mindestens einem Evidenz-Tag. */
  evidenceTopics?: readonly string[];
  /** Höchstzahl Items je Quelle. Ohne Angabe kein Deckel. */
  maxPerSource?: number;
  /** Mindest-Relevanz. Ohne Angabe gilt MIN_RELEVANCE. */
  minRelevance?: number;
  limit?: number;
}

/**
 * Liefert die gefilterten und sortierten Items samt Quelle — das, was
 * `GET /api/news` ausgibt.
 *
 * Sortierung: Relevanz absteigend, dann Datum absteigend.
 * Grundfilter (immer aktiv): Score >= MIN_RELEVANCE und Sprache `de`.
 */
export async function queryNews(query: NewsQuery = {}): Promise<NewsItemWithSource[]> {
  const [items, sources] = await Promise.all([loadNews(), listSources()]);

  const sourceById = new Map<string, SourceLight>(
    sources.map((s) => [
      s.id,
      { id: s.id, name: s.name, category: s.category, iconName: s.iconName },
    ])
  );

  const matches = buildFilter(query);

  const result: NewsItemWithSource[] = [];
  for (const item of items) {
    const source = sourceById.get(item.sourceId);
    // Items ohne Quelle sind Waisen (Quelle wurde gelöscht) — ausblenden.
    if (!source) continue;
    if (!matches(item, source)) continue;
    result.push({ ...item, source });
  }

  result.sort(
    (a, b) =>
      b.relevanceScore - a.relevanceScore ||
      b.publishedAt.getTime() - a.publishedAt.getTime()
  );

  const capped =
    query.maxPerSource === undefined ? result : capPerSource(result, query.maxPerSource);

  return query.limit !== undefined ? capped.slice(0, query.limit) : capped;
}

/**
 * Begrenzt den Beitrag einer einzelnen Quelle.
 *
 * Erwartet eine bereits sortierte Liste: behalten werden je Quelle die
 * ersten Einträge — also die relevantesten, bei gleichem Score die neuesten.
 */
function capPerSource(items: NewsItemWithSource[], max: number): NewsItemWithSource[] {
  const perSource = new Map<string, number>();
  const kept: NewsItemWithSource[] = [];

  for (const item of items) {
    const used = perSource.get(item.sourceId) ?? 0;
    if (used >= max) continue;
    perSource.set(item.sourceId, used + 1);
    kept.push(item);
  }

  return kept;
}

/**
 * Baut aus der Abfrage ein Prädikat für ein einzelnes Item.
 *
 * Die Vorbereitung (Suchfunktion, Tag-Menge) passiert einmal beim Bauen,
 * nicht pro Item — und `queryNews` bleibt eine reine Schleife.
 */
function buildFilter(query: NewsQuery): (item: NewsItem, source: SourceLight) => boolean {
  const matchesSearch = query.search ? buildSearchMatcher(query.search) : null;
  const evidence = query.evidenceTopics ? new Set(query.evidenceTopics) : null;
  const minScore = query.minRelevance ?? MIN_RELEVANCE;

  return (item, source) => {
    if (item.relevanceScore < minScore) return false;
    // 'unknown' wird beim Einlesen auf 'de' abgebildet, daher reicht der
    // exakte Vergleich.
    if (item.lang !== 'de') return false;
    if (query.category && source.category !== query.category) return false;
    if (query.since && item.publishedAt < query.since) return false;
    if (query.topNewsOnly && !item.isTopNews) return false;
    if (query.tag && !item.topics.includes(query.tag)) return false;
    if (evidence && !item.topics.some((t) => evidence.has(t))) return false;
    if (matchesSearch && !matchesSearch(`${item.title} ${item.summary ?? ''}`)) return false;
    return true;
  };
}

/**
 * Baut eine Suchfunktion aus der Eingabe des Nutzers.
 *
 * Ersetzt die frühere Postgres-Volltextsuche (`websearch_to_tsquery` mit
 * deutschem Stemmer). Ohne Datenbank gibt es kein Stemming mehr; gesucht
 * wird auf normalisierten Teilstrings (Groß-/Kleinschreibung und Umlaute
 * egal). In der Praxis trägt das für kurze Titel gut, „Verordnungen"
 * findet aber nicht mehr automatisch „Verordnung".
 *
 * Unterstützt weiterhin:
 *  - mehrere Begriffe  → alle müssen vorkommen (UND)
 *  - "…" in Anführungszeichen → zusammenhängende Wortfolge
 *  - -Begriff          → darf nicht vorkommen
 */
function buildSearchMatcher(rawQuery: string): (haystack: string) => boolean {
  const required: string[] = [];
  const forbidden: string[] = [];

  // Zerlegt in Anführungszeichen-Gruppen und einzelne Wörter, jeweils
  // optional mit führendem Minus.
  const tokens = rawQuery.match(/-?"[^"]*"|-?\S+/g) ?? [];
  for (const token of tokens) {
    const negated = token.startsWith('-');
    const bare = (negated ? token.slice(1) : token).replace(/^"|"$/g, '').trim();
    if (!bare) continue;
    (negated ? forbidden : required).push(normalizeForSearch(bare));
  }

  return (haystack: string) => {
    const normalized = normalizeForSearch(haystack);
    if (forbidden.some((term) => normalized.includes(term))) return false;
    return required.every((term) => normalized.includes(term));
  };
}

/** Kleinbuchstaben, Akzente entfernt, Whitespace vereinheitlicht. */
function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
