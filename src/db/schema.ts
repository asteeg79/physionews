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
    // Relevanz-Klassifizierung: 0 = irrelevant, 10 = hochrelevant für Physiotherapie
    relevanceScore: integer('relevance_score').notNull().default(5),
    relevanceMethod: relevanceMethodEnum('relevance_method').notNull().default('pending'),
    relevanceReason: text('relevance_reason'),
  },
  (t) => [
    index('news_published_idx').on(t.publishedAt),
    index('news_source_idx').on(t.sourceId),
    index('news_relevance_idx').on(t.relevanceScore),
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
});

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type NewsCategory = (typeof categoryEnum.enumValues)[number];
