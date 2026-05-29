CREATE TABLE "gemini_cache" (
	"title_hash" text PRIMARY KEY NOT NULL,
	"score" integer NOT NULL,
	"topics" text[] DEFAULT '{}' NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gemini_usage" (
	"date" text PRIMARY KEY NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"requests_made" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news_items" ADD COLUMN "lang" text DEFAULT 'de' NOT NULL;