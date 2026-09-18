/**
 * Domänen-Typen der App.
 *
 * Früher wurden diese Typen aus dem Drizzle-Schema abgeleitet
 * (`typeof sources.$inferSelect`). Seit der Umstellung auf JSON-Dateien
 * im Repo sind sie hier von Hand definiert — sie beschreiben zugleich das
 * Format der Dateien in `data/`.
 *
 * Konvention: Zeitpunkte sind im Speicher `Date`-Objekte und in den
 * JSON-Dateien ISO-8601-Strings. Die Umwandlung passiert zentral beim
 * Laden/Schreiben in den jeweiligen Repository-Modulen.
 */

/**
 * Quellen-Kategorien. Die ersten sechs Werte sind historisch gewachsen,
 * im Frontend werden nur `fachlich`, `gesetz` und `politik` als Tabs
 * gezeigt (siehe lib/categories.ts).
 */
export const NEWS_CATEGORIES = [
  'berufspolitik',
  'recht',
  'evidenz',
  'fortbildung',
  'leitlinien',
  'allgemein',
  'fachlich',
  'gesetz',
  'politik',
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const RELEVANCE_METHODS = ['keyword', 'ai', 'manual', 'pending'] as const;

export type RelevanceMethod = (typeof RELEVANCE_METHODS)[number];

/** Eine News-Quelle samt Abruf-Status. Datei: `data/sources.json`. */
export interface Source {
  id: string;
  name: string;
  url: string;
  adapterType: string;
  category: NewsCategory;
  iconName: string | null;
  isEnabled: boolean;
  notificationsEnabled: boolean;
  lastFetchAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  /**
   * Wie viele Beiträge der letzte erfolgreiche Abruf geparst hat.
   *
   * Bewusst die geparste Menge, nicht die der neuen Items: eine Quelle ohne
   * neue Beiträge ist normal, eine ohne jeden geparsten Beitrag ist kaputt.
   * `null` = noch nie erfolgreich abgerufen.
   */
  lastItemCount: number | null;
  /**
   * Wie viele erfolgreiche Abrufe in Folge nichts geparst haben.
   *
   * Ohne diesen Zähler war eine tote Quelle von einer stillen nicht zu
   * unterscheiden: `lastSuccessAt` wurde gesetzt, sobald der HTTP-Abruf
   * durchging — auch wenn der Adapter am veränderten Markup scheiterte.
   */
  emptyRunsInARow: number;
  createdAt: Date;
}

/**
 * Ein News-Item. Datei: `data/news.json`.
 *
 * `isRead` existiert hier bewusst NICHT mehr: seit die Daten nur noch von
 * GitHub Actions geschrieben werden, ist „gelesen" eine reine Geräte-
 * Eigenschaft und liegt im localStorage (siehe lib/read-state.ts).
 */
export interface NewsItem {
  /** sha256(sourceId + '|' + normalize(url) + '|' + normalize(title)) */
  id: string;
  sourceId: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
  fetchedAt: Date;
  /** 0 = irrelevant, 10 = hochrelevant für Physiotherapie. */
  relevanceScore: number;
  relevanceMethod: RelevanceMethod;
  relevanceReason: string | null;
  /** Von der KI pro Durchlauf neu gesetzt; markiert 1–3 echte Top-News. */
  isTopNews: boolean;
  /** Themen-Tags aus geschlossener Liste, siehe lib/relevance/topics.ts. */
  topics: string[];
  /** Nur `de` wird im Frontend angezeigt. */
  lang: string;
}

/** Quellen-Felder, die zusammen mit einem Item ausgeliefert werden. */
export type SourceLight = Pick<Source, 'id' | 'name' | 'category' | 'iconName'>;

/** Ein News-Item inklusive seiner Quelle — das Format der News-API. */
export type NewsItemWithSource = NewsItem & { source: SourceLight };

/** App-weite Einstellungen. Datei: `data/settings.json`. */
export interface AppSettings {
  refreshIntervalHours: number;
  refreshWindowStart: number;
  refreshWindowEnd: number;
  retentionDays: number;
  /**
   * Mindest-Relevanz für die Anzeige (4–9). Items darunter bleiben
   * gespeichert — der Wert lässt sich also jederzeit ohne neuen Abruf drehen.
   */
  minRelevance: number;
  /** Höchstzahl Meldungen je Quelle in der Übersicht. */
  maxItemsPerSource: number;
  notificationsEnabled: boolean;
  lastGlobalRefreshAt: Date | null;
}

/** Eine Web-Push-Subscription. Datei: `data/push-subscriptions.enc.json`. */
export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}

/** Tagesverbrauch der Gemini-API. Datei: `data/gemini-usage.json`. */
export interface GeminiUsageDay {
  /** UTC-Tag im Format YYYY-MM-DD (Gemini-Tagesquota ist UTC-basiert). */
  date: string;
  tokensUsed: number;
  requestsMade: number;
  updatedAt: Date;
}

/** Ein Eintrag im Klassifizierungs-Cache. Datei: `data/gemini-cache.json`. */
export interface GeminiCacheEntry {
  titleHash: string;
  score: number;
  topics: string[];
  reason: string;
  createdAt: Date;
}
