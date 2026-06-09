import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

export const categoryEnum = pgEnum('news_category', [
  // alte Werte werden behalten für Backwards-Compatibility,
  // im Frontend nutzen wir nur noch die drei neuen
  'berufspolitik',
  'recht',
  'evidenz',
  'fortbildung',
  'leitlinien',
  'allgemein',
  'fachlich',
  'gesetz',
  'politik',
]);

export const relevanceMethodEnum = pgEnum('relevance_method', [
  'keyword',
  'ai',
  'manual',
  'pending',
]);

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  adapterType: text('adapter_type').notNull(),
  category: categoryEnum('category').notNull(),
  iconName: text('icon_name'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
  lastFetchAt: timestamp('last_fetch_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const newsItems = pgTable(
  'news_items',
  {
    // sha256(sourceId + '|' + normalize(url) + '|' + normalize(title))
    id: text('id').primaryKey(),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary'),
    url: text('url').notNull(),
    imageUrl: text('image_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    isRead: boolean('is_read').notNull().default(false),
    /**
     * Zeitpunkt der ersten Push-Notification für dieses Item. NULL = noch nie
     * notifiziert. Strikt einmal-pro-Item: sobald gesetzt, wird das Item
     * NIE wieder gepusht — egal ob gelesen, gelöscht und re-inserted, oder
     * von mehreren Cron-Endpoints parallel angefasst.
     *
     * Ersetzt die frühere lockerere `app_settings.last_notified_at`-Cutoff-
     * Logik (siehe push-sender.ts notifyNewHighRelevanceItems).
     */
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    // Relevanz-Klassifizierung: 0 = irrelevant, 10 = hochrelevant für Physiotherapie
    relevanceScore: integer('relevance_score').notNull().default(5),
    relevanceMethod: relevanceMethodEnum('relevance_method').notNull().default('pending'),
    relevanceReason: text('relevance_reason'),
    // Top-News-Flag: von AI per Cron-Lauf gesetzt; bei jedem Cron neu evaluiert.
    // Markiert 1-3 Items als "echte Top-News" basierend auf Aktualität, Vielfalt und Bedeutung.
    isTopNews: boolean('is_top_news').notNull().default(false),
    // Themen-Tags aus geschlossener Liste (siehe lib/relevance/topics.ts).
    // Werden von der AI-Klassifizierung beim Bewerten mit ermittelt.
    // Beispiel: ['Wirbelsäule', 'Manuelle Therapie', 'GKV']
    topics: text('topics').array().notNull().default([]),
    // Sprache des Items — Default 'de'. Items mit 'en' (oder andere)
    // werden vom Frontend ausgeblendet, da unsere Zielgruppe deutschsprachig ist.
    lang: text('lang').notNull().default('de'),
  },
  (t) => [
    index('news_published_idx').on(t.publishedAt),
    index('news_source_idx').on(t.sourceId),
    index('news_top_news_idx').on(t.isTopNews),
    // Composite-Index für die häufigste Sortier-Query (Relevanz + Datum).
    // Partial-Index, da Items mit score < 4 ohnehin gelöscht werden.
    index('news_sort_idx').on(t.relevanceScore.desc(), t.publishedAt.desc()),
  ]
);

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpoint: text('endpoint').notNull().unique(),
  keys: jsonb('keys').notNull().$type<{ p256dh: string; auth: string }>(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  refreshIntervalHours: integer('refresh_interval_hours').notNull().default(2),
  refreshWindowStart: integer('refresh_window_start').notNull().default(6),
  refreshWindowEnd: integer('refresh_window_end').notNull().default(22),
  retentionDays: integer('retention_days').notNull().default(30),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
  lastGlobalRefreshAt: timestamp('last_global_refresh_at', { withTimezone: true }),
  /**
   * Cutoff für Push-Benachrichtigungen: nur News-Items mit
   * `fetched_at > last_notified_at` werden gepusht. Verhindert, dass
   * dasselbe Item zwei Mal benachrichtigt wird, wenn der classify-Cron
   * mehrfach pro Refresh-Zyklus läuft (GitHub-Actions-Loop).
   */
  lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
});

/**
 * Tagesweise Gemini-Token-Verbrauchszähler.
 * date ist der UTC-Tag (Gemini-Tagesquota ist UTC-basiert).
 */
export const geminiUsage = pgTable('gemini_usage', {
  date: text('date').primaryKey(), // YYYY-MM-DD UTC
  tokensUsed: integer('tokens_used').notNull().default(0),
  requestsMade: integer('requests_made').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cache für Gemini-Klassifizierungen. Identische Titel (genormter Hash)
 * brauchen nur einmal pro Refresh-Zyklus den API-Call.
 */
export const geminiCache = pgTable('gemini_cache', {
  titleHash: text('title_hash').primaryKey(),
  score: integer('score').notNull(),
  topics: text('topics').array().notNull().default([]),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type NewsCategory = (typeof categoryEnum.enumValues)[number];
