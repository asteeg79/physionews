# PhysioNews

Private Progressive Web App, die für eine Physiotherapeutin alle berufsrelevanten Nachrichten (Verbände, Recht, Evidenz, Fortbildung, Leitlinien) bündelt — gefiltert mit Hybrid-KI auf das, was für den Beruf wirklich zählt.

**Live:** https://physionews.vercel.app

## Funktionen

- **Aggregation** aus ~30 deutschen Fachquellen (RSS, HTML-Scraper, Google-News-Proxies, YouTube)
- **Hybrid-KI-Filter**: Keyword-Score (Whitelist/Blacklist/Source-Bias) + Gemini 2.5 Flash Lite für Grauzonen — irrelevantes wird vor Anzeige verworfen
- **Top News**-Bereich: täglich KI-kuratierte Top-3 nach Relevanz
- **Zeitliche Gliederung** für den Rest: Heute / Diese Woche / Diesen Monat / Älter
- **Themen-Tags** pro Artikel (z. B. *RCT, S3-Leitlinie, Heilmittelversorgung*) — klickbar als Filter
- **Volltext-Suche** über Titel + Summary (Postgres `tsvector`, deutscher Stemmer)
- **„KI Klassifiziert"-Filter** (vormals „Evidenz") — zeigt nur Items mit Evidenz-Tags
- **Sprachfilter** — nur deutsche Beiträge erscheinen
- **Web-Push-Benachrichtigungen** für hochrelevante Items (Score ≥ 9), idempotent über `last_notified_at` — selbes Item wird nie doppelt gepusht
- **Auto-Refresh** alle 2 h im Fenster (Default 06–22 Europe/Berlin) via GitHub Actions
- **Refresh-on-Open** mit Rate-Limit (1×/5 min/IP)
- **PWA** — installierbar auf iPhone/Desktop, offline-fähig
- **Quellen-Management**: aktivieren, hinzufügen (Auto-Detect RSS), Push pro Quelle
- **Aufbewahrungsdauer** 7/30/90/365 Tage, „alle als gelesen", Cache leeren
- **App-Version** sichtbar in Settings + automatischer Update-Toast (Server- vs. Bundle-Version-Vergleich)
- **Gemini-Quota-Anzeige** (verbrauchte Tokens des Tages) in Settings
- Komplett auf Deutsch, Datumsformate `de-DE`, Zeitzone Europe/Berlin
- Light/Dark/System

## Technologie-Stack

- **Next.js 16** (App Router, TypeScript strict, `--webpack`-Build wegen Serwist)
- **Tailwind v4 + shadcn/ui**
- **Supabase Postgres** (EU-Region) via **Supavisor-Pooler** (postgres.js, `prepare:false`)
- **Drizzle ORM** + Migrations
- **@serwist/next** (Service Worker + Workbox-Cache-Strategien)
- **web-push** (VAPID, RFC 8030)
- **Google Gemini 2.5 Flash Lite** (Klassifizierung + Top-News-Auswahl + Themen-Tags), JSON-Schema-Output
- **Hosting:** Vercel (Frontend + API-Routes), GitHub Actions (Cron + Deploy-Fallback), Supabase (DB)

## Architektur

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Browser (iOS Safari 16.4+, Chrome, Firefox)                                          │
│                                                                                       │
│  Next.js Client                              Service Worker (Serwist)                 │
│  ├─ Logo / Header (Refresh, Settings)        ├─ Precache statische Assets             │
│  ├─ SearchBar + EbpToggle ("KI Klassifiz.")  ├─ NetworkFirst /api/news (SWR 24h)      │
│  ├─ CategoryTabs (Alle/Fachlich/Gesetz/Pol.) ├─ CacheFirst /icons (30d)               │
│  ├─ ActiveFilters (q/tag/ebp Chips)          ├─ /offline Fallback                     │
│  ├─ TopNewsSection (KI-kuratierte Top-3)     ├─ Push-Empfang (tag pro Item)           │
│  ├─ TimeBucketSection (Heute/Woche/Monat)    └─ NotificationClick → openWindow        │
│  ├─ NewsCard (expand + Live-Preview)                                                  │
│  ├─ TopicChips (klickbar als ?tag-Filter)    Client-Hintergrund-Tasks                 │
│  ├─ Settings (SettingsForm, GeminiUsage,     ├─ RefreshOnOpen (Mount/visibilitychange)│
│  │   PushSettings, VersionFooter)            ├─ SwUpdatePrompt (60s-Poll +            │
│  ├─ SourcesManager (Toggle + Add-Dialog)     │   /api/version-Mismatch → Toast)       │
│  └─ ThemeSwitcher (light/dark/system)        └─ ServiceWorkerRegistrar (Prod-only)    │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │ fetch (Cache-Control max-age=20, SWR=60)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Vercel — Next.js 16 App Router (API Routes)                                          │
│                                                                                       │
│  Lese-API                                                                             │
│  ├─ GET  /api/news        (category/q/tag/ebp/topNews/since/limit, sortiert Rel↓Date↓)│
│  ├─ GET  /api/sources                                                                 │
│  ├─ GET  /api/settings                                                                │
│  ├─ GET  /api/gemini-usage                                                            │
│  └─ GET  /api/version     (no-store, Bundle-vs-Server-Vergleich)                      │
│                                                                                       │
│  Cron (X-Cron-Secret, in 4 Endpoints aufgeteilt — je <60 s Function-Timeout)          │
│  ├─ POST /api/cron/fetch         Sources parallel abrufen → DB (status: pending)      │
│  ├─ POST /api/cron/classify      Klassifizierung (150er-Chunks, GH-Loop bis remaining)│
│  ├─ POST /api/cron/maintenance   Retention + lastRefreshAt + Top-News-Auswahl         │
│  └─ POST /api/cron/refresh       Legacy-All-in-One (für manuelles curl)               │
│                                                                                       │
│  Refresh-on-Demand                                                                    │
│  └─ POST /api/refresh-on-demand  Rate-Limit 1/5min/IP, prüft Intervall + Fenster      │
│                                                                                       │
│  Push (Web Push, VAPID)                                                               │
│  ├─ POST /api/push/subscribe / unsubscribe / test                                     │
│                                                                                       │
│  Quellen-Management                                                                   │
│  ├─ POST   /api/sources           (Auto-Detect RSS via feed-detect.ts)                │
│  ├─ PATCH  /api/sources/[id]      (isEnabled, notificationsEnabled)                   │
│  └─ DELETE /api/sources/[id]      (cascade löscht news_items)                         │
│                                                                                       │
│  Per-Item                                                                             │
│  ├─ GET  /api/news/[id]/preview   Live-Content-Extraction + Cache                     │
│  ├─ POST /api/news/[id]/read                                                          │
│  ├─ POST /api/news/mark-all-read                                                      │
│  └─ POST /api/cache/clear                                                             │
│                                                                                       │
│  Settings                                                                             │
│  └─ PATCH /api/settings           (refreshInterval/Window/retention/notifications)    │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Server-Side Logik (src/lib/)                                                         │
│                                                                                       │
│  FeedFetcher (feed-fetcher.ts)               Adapter-Registry                         │
│   ┌───────────────────────────────┐          ├─ RssAdapter                            │
│   │ SELECT FROM sources           │          ├─ YouTubeAdapter                        │
│   │  WHERE is_enabled             │          ├─ GoogleNewsAdapter (Proxy)             │
│   │ pLimit(4) → adapter.fetch     │          ├─ GenericHtmlAdapter (JSON-LD + Junk)   │
│   │ computeItemId() → ON CONFLICT │          ├─ HtmlScraperAdapter (Base)             │
│   │ Lang-Detect → lang-Spalte     │          └─ 12 spezifische HTML-Adapter           │
│   │ status = 'pending'            │             IFK, BMG, RKI, G-BA, Cochrane,        │
│   └───────────────────────────────┘             VPT, vdb-nrw, DGSP, RA Alt,           │
│                  │                              physio-deutschland, AWMF, DVMT        │
│                  ▼                                                                    │
│   Relevance-Pipeline (relevance/)             feed-detect.ts                          │
│   ┌─────────────────────────────────────┐     RSS-Auto-Discovery aus HTML             │
│   │ 1. scoreByKeywords()                │                                             │
│   │    Whitelist/Blacklist + SourceBias │     content-extractor.ts                    │
│   │    Junk-Title-Filter (18 Regex)     │     Live-Preview (article > json-ld > og)   │
│   │    → score 0–10, decision           │                                             │
│   │      (accept/reject/gray)           │     push-sender.ts                          │
│   │ 2. lang-detect → lang flag          │     • sendPushToAllSubscriptions()          │
│   │ 3. gray-Items → classifyBatch()     │     • notifyNewHighRelevanceItems()         │
│   │    Gemini 2.5 Flash Lite, JSON-Mode │       idempotent via last_notified_at       │
│   │    Cache: gemini_cache (titleHash)  │                                             │
│   │    Quota: gemini_usage (UTC-Tag)    │     cron-auth.ts / cron-window.ts           │
│   │ 4. Themen-Tags zuweisen (topics[])  │     Shared Helpers für alle Cron-Endpoints  │
│   │ 5. score < 4 → DELETE               │                                             │
│   │ 6. Push für score ≥ 9 (idempotent)  │                                             │
│   └─────────────────────────────────────┘                                             │
│                                                                                       │
│   top-news.ts                                                                         │
│   AI-Selektion täglicher Top-3 aus relevantestem Pool — Gemini-Call mit Diversität    │
│   (max 1 Item pro Source) als Fallback wenn AI ausfällt                               │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │ Drizzle ORM (postgres.js, prepare:false)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Supabase Postgres (EU-Region, via Supavisor Session-Pooler Port 5432)                │
│                                                                                       │
│  sources                       news_items                          gemini_usage       │
│  ├─ id (uuid)                  ├─ id (sha256-hex)                  ├─ date (UTC)      │
│  ├─ name, url, category        ├─ source_id FK                     ├─ tokensUsed      │
│  ├─ adapter_type               ├─ title, summary, url, imageUrl    └─ requestsMade    │
│  ├─ is_enabled                 ├─ published_at, fetched_at                            │
│  ├─ notifications_enabled      ├─ relevance_score (idx)            gemini_cache       │
│  ├─ icon_name                  ├─ relevance_method                 ├─ title_hash (pk) │
│  └─ last_error                 │   (pending/keyword/ai/manual)     ├─ score           │
│                                ├─ topics text[] (GIN-Index)        ├─ topics          │
│  push_subscriptions            ├─ lang (de/en/unknown)             └─ created_at      │
│  ├─ endpoint (uniq)            ├─ is_top_news (bool)                                  │
│  ├─ keys (jsonb)               ├─ is_read                          app_settings (id=1)│
│  ├─ user_agent                 └─ search_vector (GENERATED tsvector│ ├─ refreshInterval│
│  └─ last_seen_at                  + GIN-Index, deutscher Stemmer)  │ ├─ refreshWindow* │
│                                                                    │ ├─ retentionDays  │
│                                                                    │ ├─ notifEnabled   │
│                                                                    │ ├─ lastGlobalRfsh │
│                                                                    │ └─ lastNotifiedAt │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                          ▲
                                          │ HTTP POST X-Cron-Secret
                                          │ alle 2 h zwischen 04–20 UTC (06–22 Berlin)
┌─────────────────────────────────────────┴───────────────────────────────────────────┐
│ GitHub Actions                                                                       │
│ ├─ .github/workflows/cron-refresh.yml    fetch → classify×N (loop bis remaining=0)   │
│ │                                            → maintenance                           │
│ └─ .github/workflows/deploy.yml          Fallback Vercel-Deploy on push:main         │
│                                          (für den Fall, dass Vercel-Git-App ausfällt)│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Datenfluss eines News-Items

1. **GitHub Actions** triggert `/api/cron/fetch` (2-h-Takt, im Fenster).
2. **FeedFetcher** liest aktivierte Sources, ruft pro Adapter parallel (max 4) den Inhalt ab — `computeItemId() = sha256(srcId|url|title)`, Insert mit `ON CONFLICT DO NOTHING`, Sprache wird heuristisch erkannt, Status = `pending`.
3. GitHub Actions ruft anschließend `/api/cron/classify` in 150er-Chunks auf, bis `remaining=0` (max 6 ×).
4. **Relevance-Pipeline**: erst `scoreByKeywords` (Whitelist/Blacklist + Source-Bias + Junk-Filter). Klare Treffer → `accept`/`reject`. Grauzone → Gemini-Batch mit JSON-Schema-Output. Treffer werden via `gemini_cache` (Title-Hash) erneut wiederverwendet, Token-Verbrauch in `gemini_usage` getrackt.
5. **Themen-Tags** werden im selben Gemini-Call vergeben (ca. 35 Tag-Taxonomie, inkl. Evidenz-Tags wie `RCT`, `S3-Leitlinie`).
6. Items mit Score < 4 oder mit Sprache ≠ `de` werden **gelöscht** bzw. **gefiltert**. Items mit Score ≥ 9 lösen pro Stück eine **Push-Notification** aus — idempotent über `app_settings.last_notified_at` (selbes Item nie doppelt).
7. **`/api/cron/maintenance`** macht Retention-Cleanup (älter als `retentionDays`), aktualisiert `lastGlobalRefreshAt` und stößt die **AI-Top-News-Selektion** an (Diversitäts-Fallback: 1 Item pro Quelle).
8. Frontend lädt `/api/news` (mit `Cache-Control: max-age=20, SWR=60` + `CDN-Cache-Control: s-maxage=60, SWR=300`) — alte Liste bleibt während Filter-Wechsel sichtbar, nur ein Progress-Bar erscheint oben.
9. **Klick auf Karte**: Live-Preview via Content-Extractor (gecacht), Optimistic-Mark-as-Read.

### Verzeichnisstruktur

```
src/
├── app/                          Next.js App Router
│   ├── (app)/                    Hauptansicht (Logo + Tabs + Liste)
│   │   ├── page.tsx              Startseite (alle Kategorien)
│   │   ├── kategorie/[slug]/     Fachlich / Gesetz / Politik
│   │   └── settings/
│   │       ├── page.tsx          App, Erscheinungsbild, Push, Quellen, KI-Quota, Verhalten, Version
│   │       └── sources/page.tsx  Quellen-Management
│   ├── api/                      Alle API-Routes (siehe Architektur)
│   ├── offline/                  Offline-Fallback (precached)
│   ├── sw.ts                     Service Worker (Serwist + Custom Push-Handler)
│   ├── layout.tsx                Root: SW-Registrar, SwUpdatePrompt, Theme-Script
│   ├── manifest.webmanifest      PWA-Manifest
│   └── globals.css               Tailwind + Brand-Tokens
│
├── components/                   UI-Komponenten
│   ├── Logo.tsx                  Symbol + Wortmarke (Design „Bewegung")
│   ├── Header.tsx                Sticky Header mit Refresh + Settings
│   ├── CategoryTabs.tsx          Tab-Navigation
│   ├── SearchBar.tsx             Volltext-Suche
│   ├── EbpToggle.tsx             „KI Klassifiziert"-Filter
│   ├── ActiveFilters.tsx         q/tag/ebp Chips über der Liste
│   ├── TopNewsSection.tsx        AI-kuratierte Top-3
│   ├── TimeBucketSection.tsx     Heute/Woche/Monat-Gruppierung
│   ├── NewsCard.tsx              Karte mit Expand + Live-Preview + TopicChips
│   ├── NewsList.tsx              Orchestriert Sections + Stale-While-Loading
│   ├── SettingsForm.tsx          Refresh/Retention/Push/Aktionen
│   ├── SourcesManager.tsx        Liste + Toggles
│   ├── PushSettings.tsx          Aktivieren / Test / Deaktivieren
│   ├── PushPermissionBanner.tsx  Onboarding-Banner
│   ├── InstallPrompt.tsx         iOS + Chrome beforeinstallprompt
│   ├── InstallStatus.tsx         Settings-Info
│   ├── ThemeSwitcher.tsx         Hell/Dunkel/System
│   ├── RefreshOnOpen.tsx         Mount + visibilitychange-Hook
│   ├── SwUpdatePrompt.tsx        Update-Toast (SW-waiting + Version-Mismatch)
│   ├── ServiceWorkerRegistrar.tsx
│   ├── GeminiUsagePanel.tsx      Tageskonsum in Settings
│   ├── VersionFooter.tsx         App vs. Server-Version im Settings-Footer
│   ├── settings/                 Wiederverwendbare Settings-Bausteine
│   ├── sources/                  Sources-Manager-Bausteine (Row, AddDialog)
│   └── ui/                       shadcn/ui (button, card, dialog, …)
│
├── lib/                          Business-Logic, frei von React
│   ├── adapters/
│   │   ├── registry.ts           Type-ID → Adapter-Instance
│   │   ├── rss.ts                RssAdapter (rss-parser + fetch)
│   │   ├── youtube.ts            YouTubeAdapter (Channel-ID-Resolution)
│   │   ├── google-news.ts        GoogleNewsAdapter (für junk-anfällige Quellen)
│   │   ├── html/
│   │   │   ├── base.ts           HtmlScraperAdapter (Date-Helpers, Headers)
│   │   │   ├── generic.ts        GenericHtmlAdapter (JSON-LD + DOM + Junk-Filter)
│   │   │   ├── ifk.ts, bmg.ts, rki.ts, gba.ts, vpt.ts, vdb-nrw.ts,
│   │   │   ├── physio-deutschland.ts, dgsp.ts, ra-alt.ts, cochrane.ts,
│   │   │   ├── awmf.ts, dvmt.ts
│   │   └── types.ts
│   ├── relevance/
│   │   ├── keywords.ts           Whitelist/Blacklist + Source-Bias + scoreByKeywords + Junk-Filter
│   │   ├── topics.ts             Themen-Tag-Taxonomie + EVIDENCE_TOPICS
│   │   ├── gemini.ts             Gemini-Batch-Klassifizierer (JSON-Schema-Mode)
│   │   ├── gemini-cache.ts       Title-Hash-Cache für wiederholte Items
│   │   ├── gemini-quota.ts       Tages-Tokenzähler (UTC)
│   │   ├── top-news.ts           AI-Top-News-Selektion + Diversitäts-Fallback
│   │   └── index.ts              Pipeline-Orchestrator (classifyPendingItems)
│   ├── feed-fetcher.ts           Top-Level Cron-Logik (Parallelisierung, Lang-Detect)
│   ├── feed-detect.ts            RSS-Auto-Discovery aus HTML
│   ├── content-extractor.ts      Live-Preview (article > json-ld > og:desc)
│   ├── push-sender.ts            web-push Wrapper + notifyNewHighRelevanceItems (idempotent)
│   ├── lang-detect.ts            de/en-Heuristik (Wortendungen, Funktionswörter)
│   ├── dedup.ts                  computeItemId(sourceId, url, title)
│   ├── time-bucket.ts            getTimeBucket(date) → Heute/Woche/Monat/Älter
│   ├── timezone.ts               getBerlinHour() für Window-Checks
│   ├── format-date.ts            de-DE Relativzeiten
│   ├── rate-limit.ts             In-Memory-Bucket pro IP
│   ├── cron-auth.ts              X-Cron-Secret-Check (shared)
│   ├── cron-window.ts            Berlin-Hour-Window-Check (shared)
│   ├── pwa-status.ts             isStandalone/isIos/supportsPush
│   ├── theme.ts                  Hell/Dunkel/System Persistence
│   ├── categories.ts             Sichtbare vs. Legacy-Kategorien
│   └── utils.ts                  cn(), kleine Helfer
│
├── db/
│   ├── schema.ts                 Drizzle (6 Tabellen: sources, news_items, push_subs,
│   │                             app_settings, gemini_usage, gemini_cache)
│   ├── migrations/               0000–0006
│   ├── seed.ts                   Default-Quellen + App-Settings
│   └── index.ts                  postgres.js-Client (SSL, prepare:false für Pooler)
│
└── tests/                        Vitest (108 Tests in 17 Files)
    ├── adapters/                 RSS, YouTube, Generic, HTML-spezifisch, Google News
    ├── lib/                      Categories, Rate-Limit, Content-Extractor, Lang-Detect
    ├── relevance/                scoreByKeywords (alle Branches), Topics
    ├── dedup.test.ts
    └── time-bucket.test.ts

scripts/                          Operationelle Helfer (manuell via tsx ausführen)
├── generate-icons.ts             SVG → PNG via sharp
├── reclassify-all.ts             Items neu klassifizieren (z. B. nach Keyword-Update)
├── purge-irrelevant.ts           Score < 4 löschen
├── add-new-sources.ts            Bulk-Import zusätzlicher Quellen
└── verify-db.ts                  DB-Stand inspizieren

.github/workflows/
├── cron-refresh.yml              fetch → classify-loop → maintenance (alle 2 h)
└── deploy.yml                    Vercel-Deploy-Fallback (push:main)
```

## Setup von Null

### 1. Voraussetzungen

- Node.js 20+ (CI nutzt 22)
- npm 10+
- Supabase-Account, Vercel-Account, GitHub-Account
- Google AI Studio API-Key (Gemini, kostenlose Tier reicht)

### 2. Repo klonen + Dependencies

```bash
git clone https://github.com/asteeg79/physionews.git
cd physionews
npm install
```

### 3. Supabase-Projekt anlegen

1. [supabase.com](https://supabase.com) → New Project, **EU-Region** (eu-west-1 Ireland oder eu-central-1 Frankfurt)
2. **Settings → Database → Connection Pooling → Session Mode (Port 5432)** — diese URL kopieren, **nicht** die direkte `db.*.supabase.co`-URL (löst nur IPv6 auf, funktioniert nicht auf Vercel)
3. Password URL-kodieren falls Sonderzeichen enthalten (`*` → `%2A`)

### 4. `.env.local` anlegen

```bash
cp .env.example .env.local
```

| Variable | Quelle |
|---|---|
| `DATABASE_URL` | Pooler-URL aus Supabase (Session-Mode Port 5432) |
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API (geheim) |
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey |
| `VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | s. o. |
| `VAPID_SUBJECT` | `mailto:deine@email.de` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | gleicher Wert wie `VAPID_PUBLIC_KEY` |
| `CRON_SECRET` | `openssl rand -hex 32` |

### 5. Datenbank migrieren und seeden

```bash
npm run db:generate   # SQL aus Drizzle-Schema generieren
npm run db:migrate    # auf Supabase ausführen
npm run seed          # App-Settings + Default-Quellen anlegen
```

### 6. App-Icons generieren (einmalig)

```bash
npx tsx scripts/generate-icons.ts
```

Erzeugt 192/512, maskable, apple-touch und favicon-32 in `public/icons/`.

### 7. Lokal starten

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000) (Service-Worker ist im Dev-Modus deaktiviert.)

## Deployment auf Vercel

1. Repo zu GitHub pushen.
2. Vercel → Import Repository.
3. **Vercel-GitHub-App** im Repo aktivieren (`https://github.com/apps/vercel` → Configure → Repository-Access).
4. Environment-Variables anlegen (alle aus `.env.local`, jeweils Production + Preview + Development). Vercel exponiert `VERCEL_GIT_COMMIT_SHA` und `VERCEL_GIT_COMMIT_REF` automatisch.
5. Erstes Deployment auslösen — `npm run build` mit `--webpack` (siehe `package.json`, wegen `@serwist/next`).
6. **GitHub Actions Secrets** unter *Repo → Settings → Secrets and Variables → Actions*:
   - `CRON_SECRET` (gleicher Wert wie in Vercel)
   - `APP_DOMAIN` (z. B. `physionews.vercel.app`)
   - Für den Deploy-Fallback-Workflow zusätzlich:
     - `VERCEL_TOKEN` (https://vercel.com/account/tokens)
     - `VERCEL_ORG_ID` (aus `.vercel/project.json`)
     - `VERCEL_PROJECT_ID` (aus `.vercel/project.json`)
7. Cron-Workflow ausführen: Tab *Actions* → *PhysioNews Feed Refresh* → *Run workflow*.

### Manueller Refresh

```bash
# Komplettlauf (legacy)
curl -X POST -H "X-Cron-Secret: $CRON_SECRET" https://physionews.vercel.app/api/cron/refresh

# Einzelne Stufen
curl -X POST -H "X-Cron-Secret: $CRON_SECRET" https://physionews.vercel.app/api/cron/fetch
curl -X POST -H "X-Cron-Secret: $CRON_SECRET" https://physionews.vercel.app/api/cron/classify
curl -X POST -H "X-Cron-Secret: $CRON_SECRET" https://physionews.vercel.app/api/cron/maintenance
```

### Vercel CLI

```bash
vercel env ls          # alle Env-Variablen
vercel env pull        # in .env.local laden
vercel logs            # Live-Logs
vercel deploy --prod   # Manueller Deploy
```

## iOS-Installation (PWA)

1. App-URL in **Safari** öffnen (nicht Chrome — sonst kein Push).
2. **Teilen-Symbol** → **Zum Home-Bildschirm**.
3. Beim ersten Öffnen erscheint der **Push-Banner** → *Aktivieren* → iOS-Erlaubnisdialog → *Erlauben*.
4. Test: **Einstellungen → Test-Push senden**.

> Web-Push auf iOS funktioniert **nur** in installierten PWAs (iOS 16.4+, März 2023). Im Browser-Tab erscheint kein Erlaubnisdialog.

## Quellen hinzufügen

In der App: **Einstellungen → Quellen verwalten → Quelle hinzufügen**

- URL eingeben (Newsseite oder direkter Feed)
- Auto-Detect:
  - Direkte XML-Antwort → `rss`-Adapter
  - HTML mit `<link rel="alternate" type="application/rss+xml">` → eingebetteter Feed
  - Google-News-Search-URL → `google-news`-Proxy (für junk-anfällige Seiten)
  - Sonst → `html:generic` (mit JSON-LD + Junk-Filter)

## Troubleshooting

### Vercel deployt seit Stunden nicht mehr (kein Update-Toast)

Die Vercel-GitHub-App im Repo war 2025 schon einmal stillschweigend ausgefallen (`/api/version` 404, neue Commits werden ignoriert). **Diagnose**: im Settings-Footer der App stehen Bundle- und Server-Version sichtbar nebeneinander — Mismatch ist sofort erkennbar.

**Fix**:
1. https://github.com/apps/vercel → *Configure* → Repository-Access für `asteeg79/physionews` neu erteilen.
2. Vercel-Dashboard → *Project → Settings → Git → Connect Git Repository* → erneut verlinken.
3. Manueller Deploy: `vercel --prod --yes`.

Als Sicherheitsnetz läuft `.github/workflows/deploy.yml` mit — sobald `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` als Secrets gesetzt sind, deployed dieser Workflow auch dann, wenn die Vercel-Git-App tot ist.

### `DATABASE_URL` hängt bei `applying migrations…`

**Ursache**: Direkte URL `db.PROJECT.supabase.co` löst seit 2024 nur IPv6 auf — funktioniert weder lokal noch auf Vercel.
**Fix**: Pooler-URL (Session-Mode, Port 5432) — siehe Schritt 3.

### `tenant/user postgres.PROJECT not found`

**Ursache**: Falsche Pooler-Region.
**Fix**: Region prüfen, Hostname `aws-0-{region}.pooler.supabase.com` anpassen.

### „outside_window" beim Cron-Aufruf

Refresh läuft nur im Fenster (Default 06–22 Berlin). Außerhalb → `{ skipped: true, reason: 'outside_window' }`. Kein Fehler.

### Push-Notifications kommen auf iOS nicht an

- PWA muss installiert sein (Standalone, nicht Browser-Tab)
- iOS 16.4+
- *iOS-Settings → Benachrichtigungen → PhysioNews → erlaubt*
- Test-Push in *Settings* ausprobieren

### Build schlägt mit Turbopack-Fehler fehl

Next.js 16 nutzt Turbopack als Default, `@serwist/next` braucht webpack. `package.json` setzt deshalb `"build": "next build --webpack"`. Nicht entfernen.

### „Kein Adapter für Typ X" im Cron-Log

Eine Source hat einen `adapter_type`, der nicht in `src/lib/adapters/registry.ts` registriert ist. Source deaktivieren oder Adapter ergänzen + registrieren.

### Gemini-Quota erschöpft

In Settings sichtbar (*KI-Klassifizierung*). Free-Tier hat tagesweise Limits — bei Engpass werden Grauzonen-Items auf `relevance_method='keyword'` zurückgestuft und auf Default-Score gesetzt; sie werden angezeigt, aber nicht thematisch getaggt. Am UTC-Tageswechsel resettet das automatisch.

## Tests

```bash
npm test           # Vitest run (108 Tests in 17 Files)
npm run test:watch
```

Coverage: Dedup, TimeBucket, Feed-Detect, Lang-Detect, alle Adapter (mit gespeicherten HTML/RSS-Fixtures), Keyword-Scoring (alle Branches inkl. Junk-Filter), Topic-Taxonomie, Rate-Limit, Content-Extractor, Kategorien.

## Datenschutz

- Keine Tracker, keine Analytics.
- Daten liegen ausschließlich auf Supabase (EU) und Vercel.
- Push-Subscriptions speichern Endpoints von Apple/Google — technisch nicht zu umgehen.
- Gemini-API-Calls senden Titel + Summary an Google (USA). Für eine private Single-User-App vertretbar; bei Mehrnutzer-Deployment wären Auth + DSGVO-Aufklärung zu ergänzen.

## Lizenz

Privates Projekt. Bei Interesse an Adaption: gerne forken.
