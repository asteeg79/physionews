CREATE TYPE "public"."news_category" AS ENUM('berufspolitik', 'recht', 'evidenz', 'fortbildung', 'leitlinien', 'allgemein');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"refresh_interval_hours" integer DEFAULT 2 NOT NULL,
	"refresh_window_start" integer DEFAULT 6 NOT NULL,
	"refresh_window_end" integer DEFAULT 22 NOT NULL,
	"retention_days" integer DEFAULT 90 NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"last_global_refresh_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"url" text NOT NULL,
	"image_url" text,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"keys" jsonb NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"adapter_type" text NOT NULL,
	"category" "news_category" NOT NULL,
	"icon_name" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"last_fetch_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_published_idx" ON "news_items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "news_source_idx" ON "news_items" USING btree ("source_id");