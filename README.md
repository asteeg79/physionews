# PhysioNews

Private Progressive Web App, die für eine Physiotherapeutin alle berufsrelevanten Nachrichten (Verbände, Recht, Evidenz, Fortbildung, Leitlinien) in einer App bündelt.

**Live:** https://physionews.vercel.app

## Funktionen

- Aggregation aus ~25 deutschen Fachquellen (RSS, HTML-Scraper, YouTube)
- Zeitliche Gliederung: Heute / Diese Woche / Diesen Monat / Älter
- Web-Push-Benachrichtigungen bei neuen Inhalten (gebündelt pro Refresh)
- Automatischer Refresh alle 1/2/4 Stunden, nur im definierten Fenster (Default 06–22 Uhr Europe/Berlin)
- PWA — installierbar auf iPhone und Desktop, offline-fähig
- Quellen aktivieren/deaktivieren, neue per URL hinzufügen (Auto-Detect RSS)
- Aufbewahrungsdauer 7 / 30 / 90 / 365 Tage, „Alle als gelesen", Cache leeren
- Komplett auf Deutsch, Datumsformate `de-DE`, Zeitzone `Europe/Berlin`
- Light- und Dark-Mode (OS-Setting)

## Technologie-Stack

- **Next.js 16** (App Router, TypeScript strict)
- **Tailwind v4 + shadcn/ui**
- **Supabase** (PostgreSQL, Region EU) — via **Supavisor-Pooler**
- **Drizzle ORM**
- **@serwist/next** (Service Worker + Workbox-Cache-Strategien)
- **web-push** (VAPID, RFC 8030)
- **Hosting:** Vercel (Frontend + API), GitHub Actions (Cron-Trigger), Supabase (DB)

## Architektur

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Browser (iOS Safari 16.4+, Chrome, Firefox)                                   │
│                                                                                │
│  Next.js Client                            Service Worker (Serwist)            │
│  ├─ Logo                                   ├─ Precache statische Assets        │
│  ├─ Header (Refresh)                       ├─ NetworkFirst /api/news (SWR 24h) │
│  ├─ CategoryTabs (Fachlich/Gesetz/Politik) ├─ CacheFirst /icons (30d)          │
│  ├─ TopNewsSection (Top-3 nach Relevanz)   ├─ /offline Fallback                │
│  ├─ TimeBucketSection (Heute/Woche/Monat)  ├─ Push-Empfang (tag pro Item)      │
│  ├─ NewsCard (aufklappbar + Live-Preview)  └─ NotificationClick → openWindow   │
│  ├─ Settings (SettingsForm / SourcesManager)                                   │
│  ├─ PushPermissionBanner / InstallPrompt                                       │
│  ├─ ThemeSwitcher (light/dark/system, localStorage)                            │
│  └─ RefreshOnOpen (Mount + visibilitychange → /api/refresh-on-demand)          │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ fetch
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Vercel — Next.js App Router (API Routes)                                      │
│                                                                                │
│  Frontend-Daten            Lese-Operationen                                   │
│  ├─ GET  /api/news         (sortiert nach relevanceScore DESC, pubDate DESC)   │
│  ├─ GET  /api/settings                                                         │
│  └─ GET  /api/sources                                                          │
│                                                                                │
│  Cron & Refresh                                                                │
│  ├─ POST /api/cron/refresh        ← GitHub Actions (X-Cron-Secret)             │
│  └─ POST /api/refresh-on-demand   ← App-Open (Rate-Limit 1/5min, IP-Bucket)    │
│                                                                                │
│  Push (Web Push, VAPID)                                                        │
│  ├─ POST /api/push/subscribe      → DB push_subscriptions                      │
│  ├─ POST /api/push/unsubscribe                                                 │
│  └─ POST /api/push/test           (Test-Notification, manuell aus Settings)    │
│                                                                                │
│  Quellen-Management                                                            │
│  ├─ POST   /api/sources           (mit Auto-Detect RSS)                        │
│  ├─ PATCH  /api/sources/[id]      (isEnabled, notificationsEnabled)            │
│  └─ DELETE /api/sources/[id]      (cascade löscht news_items)                  │
│                                                                                │
│  Per-Item                                                                      │
│  ├─ GET  /api/news/[id]/preview   (Live-Content-Extraction + Cache)            │
│  ├─ POST /api/news/[id]/read      (is_read=true)                               │
│  ├─ POST /api/news/mark-all-read                                               │
│  └─ POST /api/cache/clear                                                      │
│                                                                                │
│  Settings                                                                      │
│  └─ PATCH /api/settings           (refreshInterval/Window/retention/notif.)    │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Server-Side Logik (src/lib/)                                                  │
│                                                                                │
│  FeedFetcher (lib/feed-fetcher.ts)                                            │
│   ┌──────────────────────────────────────────────────────────────┐            │
│   │  1. SELECT FROM sources WHERE is_enabled                      │            │
│   │  2. pLimit(4) → adapter.fetch(source) mit 1× Retry            │            │
│   │  3. computeItemId() = sha256(srcId | url | title) → ON CONFLICT│           │
│   │  4. classifyPendingItems()                                    │            │
│   └──────────────────────────────────────────────────────────────┘            │
│                            │                                                   │
│             ┌──────────────┴──────────────┐                                    │
│             ▼                              ▼                                   │
│   Adapter-Registry                Relevance-Pipeline                          │
│   ├─ RssAdapter                   ┌──────────────────────────────────┐         │
│   ├─ YouTubeAdapter               │ scoreByKeywords()                 │        │
│   ├─ GoogleNewsAdapter (Proxy)    │  Whitelist/Blacklist + SourceBias │        │
│   ├─ GenericHtmlAdapter           │  → score 0-10, decision           │        │
│   ├─ 11 spezifische Html-Adapter  │     (accept/reject/gray)          │        │
│   │  (IFK, BMG, RKI, G-BA, …)     ├──────────────────────────────────┤         │
│   └─ feed-detect (Auto-Discovery) │ gray-Items → classifyBatch()      │        │
│                                   │   Gemini 2.5 Flash Lite           │        │
│   ContentExtractor                │   JSON-Schema-Output              │        │
│   (lib/content-extractor.ts)      │   Batch von 20 Items/Call         │        │
│   article > json-ld > og:desc     ├──────────────────────────────────┤         │
│                                   │ Items mit score < 4 → DELETE      │        │
│   PushSender                      └──────────────────────────────────┘         │
│   (lib/push-sender.ts)                                                         │
│   eindeutige tag-ID pro Notification (iOS-konform)                             │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Drizzle ORM
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Supabase Postgres (EU-Region, via Supavisor Pooler)                           │
│                                                                                │
│  sources             news_items                push_subscriptions  app_settings│
│  ├─ id (uuid)        ├─ id (sha256-hex)        ├─ endpoint (uniq)  ├─ id=1     │
│  ├─ name             ├─ source_id FK           ├─ keys (jsonb)     │ Singleton │
│  ├─ url              ├─ title                  ├─ user_agent       ├─ refresh…│
│  ├─ adapter_type     ├─ summary (gecacht)      └─ last_seen_at     ├─ retention│
│  ├─ category         ├─ url                                        └─ window… │
│  ├─ is_enabled       ├─ published_at                                          │
│  ├─ notifications…   ├─ relevance_score (idx)                                 │
│  └─ last_error       ├─ relevance_method (enum: keyword/ai/manual/pending)    │
│                      └─ is_read                                               │
└──────────────────────────────────────────────────────────────────────────────┘

                                       ▲
                                       │ HTTP POST X-Cron-Secret
                                       │ alle 2h zwischen 06–22 (Europe/Berlin)
┌──────────────────────────────────────┴───────────────────────────────────────┐
│ GitHub Actions — .github/workflows/cron-refresh.yml                           │
│ cron: 0 4,6,8,10,12,14,16,18,20 * * * (UTC ≈ Berlin 06–22)                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Datenfluss eines News-Items

1. **GitHub Actions** triggert `/api/cron/refresh`
2. **FeedFetcher** liest aktivierte Sources und ruft pro Adapter parallel (max 4) den Inhalt ab
3. **Adapter** parsen je nach Quelle: RSS-Parser, Cheerio (HTML), Google-News-RSS
4. **Dedup** generiert SHA-256-ID, `ON CONFLICT DO NOTHING` verhindert Duplikate
5. **Relevance-Pipeline**: erst Keyword-Score, Grauzonen-Items → Gemini-Klassifizierung
6. Items mit Score < 4 werden **gelöscht**; Items mit Score >= 9 lösen pro Stück eine **Push-Notification** aus
7. Frontend lädt sortiert nach Relevanz DESC → **TopNewsSection** (Top 3) + **TimeBucketSection** (Rest in Heute/Woche/Monat)
8. Klick auf Karte: **Live-Preview** via Content-Extractor (gecacht), **Mark-as-Read** über Optimistic UI

### Verzeichnisstruktur

```
src/
├── app/                    Next.js App Router
│   ├── (app)/              Hauptansicht-Routen (Logo + Tabs + Liste)
│   │   ├── page.tsx                  Startseite (alle Kategorien)
│   │   ├── kategorie/[slug]/         Fachlich / Gesetz / Politik
│   │   ├── settings/
│   │   │   ├── page.tsx              App, Erscheinungsbild, Push, Quellen, Verhalten
│   │   │   └── sources/page.tsx      Quellen-Management
│   ├── api/                          Alle API-Routes (s. Architektur oben)
│   ├── offline/                      Offline-Fallback (precached)
│   ├── sw.ts                         Service Worker (Serwist + Custom Push-Handler)
│   ├── layout.tsx                    Root: SW-Registrar, Theme-Script, Fonts
│   ├── manifest.webmanifest          PWA-Manifest
│   └── globals.css                   Tailwind + Brand-Tokens
│
├── components/                       UI-Komponenten
│   ├── Logo.tsx                      Symbol + Wortmarke (3 Größen)
│   ├── Header.tsx                    Sticky Header mit Refresh + Settings
│   ├── CategoryTabs.tsx              Tab-Navigation
│   ├── TopNewsSection.tsx            Top-3 nach Relevanz
│   ├── TimeBucketSection.tsx         Heute/Woche/Monat-Gruppierung
│   ├── NewsCard.tsx                  Karte mit Expand + Live-Preview
│   ├── NewsList.tsx                  Orchestriert Sections + State
│   ├── SettingsForm.tsx              Refresh/Retention/Push/Aktionen
│   ├── SourcesManager.tsx            Liste + Toggles
│   ├── PushSettings.tsx              Aktivieren/Test/Deaktivieren
│   ├── PushPermissionBanner.tsx      Onboarding-Banner
│   ├── InstallPrompt.tsx             iOS + Chrome beforeinstallprompt
│   ├── InstallStatus.tsx             Settings-Info
│   ├── ThemeSwitcher.tsx             Hell/Dunkel/System
│   ├── RefreshOnOpen.tsx             Mount + visibilitychange-Hook
│   ├── ServiceWorkerRegistrar.tsx    SW-Registration (Prod-only)
│   ├── settings/                     Wiederverwendbare Settings-Bausteine
│   │   ├── FieldGroup.tsx
│   │   ├── Toggle.tsx
│   │   ├── ActionButton.tsx
│   │   └── InfoCard.tsx
│   ├── sources/                      Sources-Manager-Bausteine
│   │   ├── SourceRow.tsx
│   │   ├── AddSourceDialog.tsx
│   │   └── types.ts
│   └── ui/                           shadcn/ui (button, card, dialog, tabs, etc.)
│
├── lib/                              Business-Logic, frei von React
│   ├── adapters/                     Source-Adapter (15 Typen)
│   │   ├── registry.ts               Type-ID → Adapter-Instance
│   │   ├── rss.ts                    RssAdapter (rss-parser + fetch)
│   │   ├── youtube.ts                YouTubeAdapter (Channel-ID-Resolution)
│   │   ├── google-news.ts            GoogleNewsAdapter (Proxy für Brightboy-Seiten)
│   │   ├── html/
│   │   │   ├── base.ts               HtmlScraperAdapter (Date-Helpers, Headers)
│   │   │   ├── generic.ts            GenericHtmlAdapter (JSON-LD + DOM-Fallback)
│   │   │   ├── ifk.ts, bmg.ts, rki.ts, cochrane.ts, physio-deutschland.ts,
│   │   │   ├── vdb-nrw.ts, dgsp.ts, ra-alt.ts, vpt.ts, gba.ts,
│   │   │   ├── awmf.ts, dvmt.ts
│   │   └── types.ts
│   ├── relevance/                    Hybrid-Klassifizierung
│   │   ├── keywords.ts               Whitelist/Blacklist + Source-Bias + scoreByKeywords
│   │   ├── gemini.ts                 Gemini-Batch-Klassifizierer (JSON-Schema-Mode)
│   │   └── index.ts                  Pipeline-Orchestrator
│   ├── feed-fetcher.ts               Top-Level Cron-Logik
│   ├── feed-detect.ts                RSS-Auto-Discovery
│   ├── content-extractor.ts          Live-Preview-Fetch + Parsing
│   ├── push-sender.ts                web-push Wrapper (eindeutige Tags)
│   ├── dedup.ts                      computeItemId(sourceId, url, title)
│   ├── time-bucket.ts                getTimeBucket(date) → Heute/Woche/Monat/Älter
│   ├── timezone.ts                   getBerlinHour() für Window-Checks
│   ├── format-date.ts                de-DE Relativzeiten
│   ├── rate-limit.ts                 In-Memory-Bucket pro IP
│   ├── pwa-status.ts                 isStandalone/isIos/supportsPush
│   ├── theme.ts                      Hell/Dunkel/System Persistence
│   └── categories.ts                 Sichtbare vs. Legacy-Kategorien
│
├── db/
│   ├── schema.ts                     Drizzle Schema (sources, news_items, push_subs, app_settings)
│   ├── migrations/                   0000_initial, 0001_relevance, 0002_categories
│   ├── seed.ts                       Default-Quellen + App-Settings
│   └── index.ts                      Postgres-Client (SSL, prepare:false für Pooler)
│
└── tests/                            Vitest (82 Tests)
    ├── adapters/                     RSS, YouTube, Generic, HTML-spezifisch, Google News
    ├── lib/                          Categories, Rate-Limit, Content-Extractor
    ├── relevance/                    scoreByKeywords (alle Branches)
    ├── dedup.test.ts
    └── time-bucket.test.ts

scripts/                              Operationelle Helfer
├── generate-icons.ts                 SVG → PNG via sharp
├── reclassify-all.ts                 Items neu klassifizieren (z.B. nach Keyword-Update)
├── purge-irrelevant.ts               Score < 4 löschen
└── verify-db.ts                      DB-Stand inspizieren
```

## Setup von Null

### 1. Voraussetzungen

- Node.js 20+
- npm 10+
- Supabase-Account, Vercel-Account, GitHub-Account (alle kostenlos)

### 2. Repo klonen + Dependencies

```bash
git clone https://github.com/asteeg79/physionews.git
cd physionews
npm install
```

### 3. Supabase-Projekt anlegen

1. [supabase.com](https://supabase.com) → New Project, **EU-Region wählen** (eu-west-1 Ireland oder eu-central-1 Frankfurt)
2. **Settings → Database → Connection Pooling → Session Mode (Port 5432)** — diese URL kopieren, NICHT die direkte `db.*.supabase.co`-URL (löst nur IPv6 auf, funktioniert nicht auf Vercel)
3. Password URL-kodieren falls Sonderzeichen enthalten (`*` → `%2A`)

### 4. `.env.local` anlegen

```bash
cp .env.example .env.local
```

Werte eintragen:

| Variable | Quelle |
|---|---|
| `DATABASE_URL` | Pooler-URL aus Supabase (Session Mode) |
| `SUPABASE_URL` | Supabase-Projekt-URL |
| `SUPABASE_ANON_KEY` | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API (geheim) |
| `VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | s.o. |
| `VAPID_SUBJECT` | `mailto:deine@email.de` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | gleicher Wert wie `VAPID_PUBLIC_KEY` |
| `CRON_SECRET` | `openssl rand -hex 32` |

### 5. Datenbank migrieren und seeden

```bash
npm run db:generate   # generiert SQL aus drizzle-Schema
npm run db:migrate    # spielt auf Supabase
npm run seed          # legt App-Settings + Default-Quellen an
```

### 6. App-Icons generieren (einmalig)

```bash
npx tsx scripts/generate-icons.ts
```

Erzeugt `public/icons/icon-{192,512}.png`, `icon-maskable-512.png`, `apple-touch-icon.png`.

### 7. Lokal starten

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## Deployment auf Vercel

1. Repo zu GitHub pushen
2. Vercel → Import Repository
3. Environment Variables anlegen (alle aus `.env.local`, jeweils Production + Preview + Development)
4. Erstes Deployment auslösen — `npm run build` mit `--webpack` (siehe `package.json`, wegen `@serwist/next`)
5. GitHub Actions Secrets setzen unter `Repo → Settings → Secrets and Variables → Actions`:
   - `CRON_SECRET` (gleicher Wert wie in Vercel)
   - `APP_DOMAIN` (z.B. `physionews.vercel.app`)
6. GitHub Actions Workflow ausführen: Tab **Actions** → **PhysioNews Feed Refresh** → **Run workflow**

### Manueller Refresh

```bash
curl -X POST \
  -H "X-Cron-Secret: $CRON_SECRET" \
  https://physionews.vercel.app/api/cron/refresh
```

### Vercel CLI für Operations

```bash
vercel env ls                    # alle Env-Variablen auflisten
vercel env pull                  # in .env.local laden
vercel logs                      # Live-Logs
vercel deploy --prod             # Manueller Deploy
```

## iOS-Installation (PWA)

1. App-URL in **Safari** öffnen (nicht Chrome — sonst kein Push)
2. **Teilen-Symbol** (Quadrat mit Pfeil) antippen → **Zum Home-Bildschirm**
3. Die App startet ab dann als Standalone
4. Beim ersten Öffnen erscheint der **Push-Banner** → **Aktivieren** → iOS-Erlaubnisdialog → **Erlauben**
5. Test: **Einstellungen → Test-Push senden**

> Web-Push auf iOS funktioniert **nur** in installierten PWAs (iOS 16.4+, März 2023). Im Browser-Tab erscheint kein Erlaubnisdialog.

## Quellen hinzufügen

In der App: **Einstellungen → Quellen verwalten → Quelle hinzufügen**

- URL eingeben (z.B. Newsseite oder direkter Feed)
- App probiert Auto-Detect:
  - Antwortet die URL direkt mit XML → RSS-Adapter
  - HTML mit `<link rel="alternate" type="application/rss+xml">` → eingebetteter Feed wird verwendet
  - Sonst → `html:generic`-Adapter (mit JSON-LD und Junk-Filter)

## Troubleshooting

### `DATABASE_URL` hängt bei `applying migrations…`

**Ursache:** Direkte URL `db.PROJECT.supabase.co` löst seit 2024 nur IPv6 auf. Lokale Macs ohne IPv6 und Vercel können sich nicht verbinden.
**Fix:** Pooler-URL nutzen — siehe Schritt 3 oben.

### `tenant/user postgres.PROJECT not found`

**Ursache:** Falsche Pooler-Region.
**Fix:** In Supabase-Dashboard die Region prüfen und Pooler-Hostname entsprechend setzen (`aws-0-{region}.pooler.supabase.com`).

### „outside_window" beim Cron-Aufruf

Refresh läuft nur im konfigurierten Fenster (Default 06–22 Europe/Berlin). Außerhalb gibt der Endpoint `{ skipped: true, reason: 'outside_window' }` zurück. Kein Fehler.

### Push-Notifications kommen auf iOS nicht an

- App muss als PWA installiert sein (Standalone, nicht Browser-Tab)
- iOS 16.4 oder neuer
- iOS-System-Einstellungen → Benachrichtigungen → PhysioNews → erlaubt
- Test-Push in **Settings** ausprobieren → liefert sofort Feedback im Toast

### Build schlägt mit Turbopack-Fehler fehl

Next.js 16 nutzt Turbopack als Default, `@serwist/next` 9.x braucht webpack. `package.json` setzt deshalb `"build": "next build --webpack"`. Nicht entfernen.

### „Kein Adapter für Typ X" im Cron-Log

Eine Source hat einen `adapter_type`, der nicht in `src/lib/adapters/registry.ts` registriert ist. Entweder Source deaktivieren oder einen passenden Adapter ergänzen und registrieren.

## Tests

```bash
npm test           # Vitest run
npm run test:watch # Watch-Modus
```

Die Suite umfasst Dedup-Logik, TimeBucket-Berechnung, Feed-Detection und Adapter-Tests mit gespeicherten HTML/RSS-Fixtures.

## Datenschutz

- Keine Tracker, keine Analytics-Skripte
- Daten liegen ausschließlich auf Supabase (EU) und Vercel
- Push-Subscriptions speichern endpoints von Apple/Google — technisch nicht zu umgehen, da deren Push-Dienste involviert sind
- Für eine private Single-User-App akzeptabel; bei Mehrnutzer-Deployment wäre eine Auth-Schicht zu ergänzen

## Lizenz

Kein öffentliches Projekt — der Code wird privat genutzt. Bei Interesse an Adaption: gerne forken.
