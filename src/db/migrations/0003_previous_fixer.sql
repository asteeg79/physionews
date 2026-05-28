ALTER TABLE "app_settings" ALTER COLUMN "retention_days" SET DEFAULT 30;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "is_top_news" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "news_top_news_idx" ON "news_items" USING btree ("is_top_news");