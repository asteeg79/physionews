CREATE TYPE "public"."relevance_method" AS ENUM('keyword', 'ai', 'manual', 'pending');--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "relevance_score" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "relevance_method" "relevance_method" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "relevance_reason" text;--> statement-breakpoint
CREATE INDEX "news_relevance_idx" ON "news_items" USING btree ("relevance_score");