DROP INDEX "news_relevance_idx";--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "topics" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "news_sort_idx" ON "news_items" USING btree ("relevance_score" DESC NULLS LAST,"published_at" DESC NULLS LAST);--> statement-breakpoint
-- Volltext-Suchvektor: kombiniert Titel und Summary mit deutschem Stemmer.
-- GENERATED ALWAYS hält den Vektor automatisch synchron, ohne Trigger.
ALTER TABLE "news_items"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(summary, '')), 'B')
  ) STORED;--> statement-breakpoint
CREATE INDEX "news_search_idx" ON "news_items" USING GIN ("search_vector");--> statement-breakpoint
CREATE INDEX "news_topics_idx" ON "news_items" USING GIN ("topics");
