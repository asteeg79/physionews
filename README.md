# PhysioNews

Private Progressive Web App, die für eine Physiotherapeutin alle berufsrelevanten Nachrichten (Verbände, Recht, Evidenz, Fortbildung, Leitlinien) bündelt — gefiltert mit Hybrid-KI auf das, was für den Beruf wirklich zählt.

**Live:** https://physionews.vercel.app

## Funktionen

- **Aggregation** aus ~30 deutschen Fachquellen (RSS, HTML-Scraper, Google-News-Proxies, YouTube)
- **Hybrid-KI-Filter**: Keyword-Score (Whitelist/Blacklist/Source-Bias) + Gemini 2.5 Flash Lite für Grauzonen — irrelevantes wird vor Anzeige verworfen
- **Top News**-Bereich: täglich KI-kuratierte Top-3 nach Relevanz
- **Zeitliche Gliederung** für den Rest: Heute / Diese Woche / Diesen Monat / Älter
- **Themen-Tags** pro Artikel (z. B. *RCT, S3-Leitlinie, Heilmittelversorgung*) — klickbar als Filter
- **Suche** über Titel + Summary (Wortfolgen in `"…"`, Ausschluss mit `-Begriff`)
- **„KI Klassifiziert"-Filter** (vormals „Evidenz") — zeigt nur Items mit Evidenz-Tags
- **Sprachfilter** — nur deutsche Beiträge erscheinen
- **Web-Push-Benachrichtigungen** für hochrelevante Items (Score ≥ 9), idempotent über `notifiedAt` pro Item — selbes Item wird nie doppelt gepusht
- **Auto-Refresh** alle 2 h im Fenster (Default 06–22 Europe/Berlin) via GitHub Actions
- **Keine Datenbank** — der gesamte Datenbestand liegt als JSON-Dateien in `data/` im Repo
- **Refresh-on-Open** mit Rate-Limit (1×/5 min/IP)
- **PWA** — installierbar auf iPhone/Desktop, offline-fähig
- **Quellen-Management**: aktivieren, hinzufügen (Auto-Detect RSS), Push pro Quelle
- **Aufbewahrungsdauer** 7/14/30/60/90 Tage, „alle als gelesen" (pro Gerät), Cache leeren
- **App-Version** sichtbar in Settings + automatischer Update-Toast (Server- vs. Bundle-Version-Vergleich)
- **Gemini-Quota-Anzeige** (verbrauchte Tokens des Tages) in Settings
- Komplett auf Deutsch, Datumsformate `de-DE`, Zeitzone Europe/Berlin
- Light/Dark/System

## Technologie-Stack

- **Next.js 16** (App Router, TypeScript strict, `--webpack`-Build wegen Serwist)
- **Tailwind v4 + shadcn/ui**
- **JSON-Dateien im Repository** (`data/`) statt Datenbank — geschrieben von GitHub Actions, gelesen aus dem Deployment-Bundle
- **@serwist/next** (Service Worker + Workbox-Cache-Strategien)
- **web-push** (VAPID, RFC 8030)
- **Google Gemini 2.5 Flash Lite** (Klassifizierung + Top-News-Auswahl + Themen-Tags), JSON-Schema-Output
- **Hosting:** Vercel (Frontend + API-Routes), GitHub Actions (Datenpflege + Deploy-Fallback)

## Architektur

Kern der Architektur: **es gibt keine Datenbank.** Der komplette Datenbestand
liegt als JSON-Dateien in `data/` im Repository.

- **GitHub Actions** ist der einzige Schreiber der Inhaltsdaten. Die Pipeline
  ruft die Quellen ab, bewertet sie, räumt auf, verschickt Push — und committet
  die geänderten Dateien.
- **Vercel** liest die Dateien aus dem Deployment-Bundle. Der Push auf `main`
  löst den Deploy aus; ein bis zwei Minuten später sind die neuen Beiträge live.
- **Änderungen aus der App** (Einstellungen, Quellen, Push-Anmeldung) gehen als
  Commit über die GitHub-Contents-API zurück ins Repo.
- **Der Lesestand** liegt pro Gerät im localStorage — er ist der einzige Zustand,
  der nirgends serverseitig landet.

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
│  ├─ NewsCard (Sheet + Live-Preview)                                                   │
│  ├─ TopicChips (klickbar als ?tag-Filter)    Client-Hintergrund-Tasks                 │
│  ├─ Settings (SettingsForm, GeminiUsage,     ├─ RefreshOnOpen (Mount/visibilitychange)│
│  │   PushSettings, VersionFooter)            ├─ SwUpdatePrompt (60s-Poll +            │
│  ├─ SourcesManager (Toggle + Add-Dialog)     │   /api/version-Mismatch → Toast)       │
│  └─ ThemeSwitcher (light/dark/system)        └─ ServiceWorkerRegistrar (Prod-only)    │
│                                                                                       │
│  localStorage: Lesestand (lib/read-state.ts) — ids + „alle gelesen bis"-Zeitstempel   │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │ fetch (Cache-Control max-age=20, SWR=60)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ Vercel — Next.js 16 App Router (read-only Dateisystem)                               │
│                                                                                       │
│  Lese-API  (liest data/*.json aus dem Deployment-Bundle)                              │
│  ├─ GET  /api/news        (category/q/tag/ebp/topNews/since/limit, sortiert Rel↓Date↓)│
│  ├─ GET  /api/sources                                                                 │
│  ├─ GET  /api/settings                                                                │
│  ├─ GET  /api/gemini-usage                                                            │
│  ├─ GET  /api/news/[id]/preview   Live-Content-Extraction (Edge-Cache 24 h)           │
│  └─ GET  /api/version     (no-store, Bundle-vs-Server-Vergleich)                      │
│                                                                                       │
│  Schreib-API  (committet über die GitHub-Contents-API → löst Deploy aus)              │
│  ├─ PATCH  /api/settings          (refreshInterval/Window/retention/notifications)    │
│  ├─ POST   /api/sources           (Auto-Detect RSS via feed-detect.ts)                │
│  ├─ PATCH  /api/sources/[id]      (isEnabled, notificationsEnabled, name)             │
│  ├─ DELETE /api/sources/[id]                                                          │
│  ├─ POST   /api/push/subscribe / unsubscribe   (verschlüsselt, s. u.)                 │
│  └─ POST   /api/cache/clear       (leert data/news.json)                              │
│                                                                                       │
│  Sonstiges                                                                            │
│  ├─ POST /api/push/test           Test-Push an alle angemeldeten Geräte               │
│  └─ POST /api/refresh-on-demand   Rate-Limit 1/5min/IP, prüft Intervall + Fenster,    │
│                                   stößt dann den Actions-Workflow an                  │
└─────────────────────────────────────────┬───────────────────────────────────────────┘
                                          │ liest
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ data/ — der Datenbestand, versioniert im Repository                                  │
│                                                                                       │
│  sources.json                  news.json                        gemini-usage.json     │
│  ├─ id (uuid)                  ├─ id (sha256-hex)               ├─ date (UTC-Tag)     │
│  ├─ name, url, category        ├─ sourceId                      ├─ tokensUsed         │
│  ├─ adapterType                ├─ title, summary, url, imageUrl └─ requestsMade       │
│  ├─ isEnabled                  ├─ publishedAt, fetchedAt           (30 Tage Historie) │
│  ├─ notificationsEnabled       ├─ relevanceScore                                      │
│  ├─ iconName                   ├─ relevanceMethod               gemini-cache.json     │
│  ├─ lastFetchAt/lastSuccessAt  │   (pending/keyword/ai/manual)  ├─ titleHash          │
│  └─ lastError                  ├─ relevanceReason               ├─ score, topics      │
│                                ├─ topics[]                      └─ createdAt          │
│  push-subscriptions.enc.json   ├─ lang (de/en)                                        │
│  └─ AES-256-GCM, Schlüssel     ├─ isTopNews                     settings.json         │
│     aus PUSH_STORE_KEY —       └─ notifiedAt (Push genau 1×)    ├─ refreshInterval    │
│     das Repo ist öffentlich                                     ├─ refreshWindow*     │
│                                „gelesen" steht bewusst NICHT    ├─ retentionDays      │
│                                hier, sondern im localStorage    ├─ notifEnabled       │
│                                                                 ├─ lastGlobalRefresh  │
│                                                                 └─ lastNotifiedAt     │
└─────────────────────────────────────────▲───────────────────────────────────────────┘
                                          │ schreibt + committet
┌─────────────────────────────────────────┴───────────────────────────────────────────┐
│ GitHub Actions — scripts/pipeline/run.ts                                             │
│ alle 2 h zwischen 04–20 UTC (06–22 Berlin), zusätzlich per workflow_dispatch          │
│                                                                                       │
│  1. fetch        FeedFetcher: aktive Quellen, pLimit(4) → adapter.fetch               │
│                  computeItemId() = sha256(srcId|url|title), Dedup gegen bekannte IDs  │
│                  Lang-Detect → lang, relevanceMethod = 'pending'                      │
│                                                                                       │
│  2. classify     1. scoreByKeywords() — Whitelist/Blacklist + Source-Bias +           │
│                     Junk-Title-Filter → score 0–10, accept/reject/gray                │
│                  2. gray-Items → classifyBatch() (Gemini 2.5 Flash Lite, JSON-Mode)   │
│                     Cache über titleHash, Tagesbudget in gemini-usage.json            │
│                  3. Themen-Tags (topics[]) aus derselben Antwort                      │
│                  4. score < 4 → Item fliegt raus                                      │
│                  5. Push für score ≥ 9, genau einmal pro Item (notifiedAt)            │
│                                                                                       │
│  3. maintenance  Retention (retentionDays; hervorgehobene Quellen ausgenommen,        │
│                  dafür auf 5 Items je Quelle begrenzt), nicht-deutsche Items raus,    │
│                  Gemini-Cache stutzen, KI-Top-News-Auswahl (Diversitäts-Fallback)     │
│                                                                                       │
│  → git commit data/ && git push  ⇒  Vercel-Deploy                                     │
│                                                                                       │
│ Server-Logik in src/lib/ (adapters/, relevance/, feed-fetcher, push-sender, …) wird   │
│ von der Pipeline und der App geteilt; src/data/ kapselt den Dateizugriff.             │
│                                                                                       │
│ .github/workflows/deploy.yml — Vercel-Deploy-Fallback (manuell auslösbar)             │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Datenfluss eines News-Items

1. **GitHub Actions** startet `scripts/pipeline/run.ts` (2-h-Takt; das Refresh-Fenster prüft die Pipeline selbst anhand von `data/settings.json`). Ein manuell ausgelöster Lauf ignoriert das Fenster.
2. **fetch**: `FeedFetcher` liest die aktivierten Quellen aus `sources.json`, ruft pro Adapter parallel (max 4) den Inhalt ab, bildet `computeItemId() = sha256(srcId|url|title)` und hängt alles Unbekannte an `news.json` an — Sprache heuristisch erkannt, `relevanceMethod = 'pending'`.
3. **classify**: erst `scoreByKeywords` (Whitelist/Blacklist + Source-Bias + Junk-Filter). Klare Treffer → `accept`/`reject`. Grauzone → Gemini-Batch mit JSON-Schema-Output. Wiederkehrende Titel kommen aus `gemini-cache.json`, der Token-Verbrauch landet in `gemini-usage.json`. Läuft in Runden zu 100 Items, bis nichts mehr offen ist.
4. **Themen-Tags** werden im selben Gemini-Call vergeben (ca. 35 Tags, inkl. Evidenz-Tags wie `RCT`, `S3-Leitlinie`).
5. Items mit Score < 4 werden **gelöscht**. Items mit Score ≥ 9 lösen je eine **Push-Notification** aus — idempotent über `notifiedAt` am Item selbst: der Zeitstempel wird vor dem Versand gesetzt und gespeichert, dasselbe Item wird deshalb nie zweimal gepusht. Ohne angemeldetes Gerät passiert gar nichts, damit nichts stillschweigend als erledigt markiert wird.
6. **maintenance**: Retention-Cleanup (älter als `retentionDays`; hervorgehobene Quellen sind ausgenommen, dafür auf 5 Items je Quelle begrenzt), nicht-deutsche Items raus, Gemini-Cache stutzen, `lastGlobalRefreshAt` setzen, **KI-Top-News-Auswahl** (Diversitäts-Fallback: 1 Item pro Quelle).
7. Der Workflow **committet `data/`** und pusht auf `main`. Vercel baut neu — ab jetzt liefert die App die neuen Daten aus.
8. Frontend lädt `/api/news` (mit `Cache-Control: max-age=20, SWR=60` + `CDN-Cache-Control: s-maxage=60, SWR=300`) — die alte Liste bleibt beim Filter-Wechsel sichtbar, oben erscheint nur eine Progress-Bar.
9. **Klick auf Karte**: Live-Preview via Content-Extractor (im Edge-Cache, 24 h), „gelesen" wird im localStorage vermerkt.

### Was die Umstellung auf JSON gekostet hat

Ehrlichkeitshalber, da diese Punkte vorher anders funktioniert haben:

| Vorher (Postgres) | Jetzt (JSON im Repo) |
|---|---|
| Neue Beiträge sofort nach dem Cron-Lauf sichtbar | erst nach Pipeline **plus Vercel-Deploy** (~1–2 min) |
| Volltextsuche mit deutschem Stemmer (`tsvector`) | Teilstring-Suche ohne Stemming — „Verordnungen" findet nicht mehr automatisch „Verordnung" |
| „gelesen" geräteübergreifend synchron | pro Gerät (localStorage) |
| Einstellungen sofort wirksam | ein Commit, wirksam nach dem nächsten Deploy |
| Vorschautexte wurden in die DB zurückgeschrieben | werden nur noch im Edge-Cache gehalten |
| Indizes skalieren mit der Datenmenge | die ganze Datei wird pro Request geparst — bei 30 Tagen Retention unkritisch, bei sehr viel mehr wäre es das nicht |

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
│   ├── feed-fetcher.ts           Abruf-Orchestrierung (Parallelisierung, Lang-Detect)
│   ├── feed-detect.ts            RSS-Auto-Discovery aus HTML
│   ├── content-extractor.ts      Live-Preview (article > json-ld > og:desc)
│   ├── push-sender.ts            web-push Wrapper + notifyNewHighRelevanceItems (idempotent)
│   ├── lang-detect.ts            de/en-Heuristik (Wortendungen, Funktionswörter)
│   ├── dedup.ts                  computeItemId(sourceId, url, title)
│   ├── time-bucket.ts            getTimeBucket(date) → Heute/Woche/Monat/Älter
│   ├── timezone.ts               getBerlinHour() für Window-Checks
│   ├── format-date.ts            de-DE Relativzeiten
│   ├── rate-limit.ts             In-Memory-Bucket pro IP
│   ├── read-state.ts             Lesestand im localStorage (pro Gerät)
│   ├── write-guard.ts            503 mit klarer Meldung, wenn Schreibzugriff fehlt
│   ├── cron-window.ts            Berlin-Hour-Window-Check (shared)
│   ├── pwa-status.ts             isStandalone/isIos/supportsPush
│   ├── theme.ts                  Hell/Dunkel/System Persistence
│   ├── categories.ts             Sichtbare vs. Legacy-Kategorien
│   └── utils.ts                  cn(), kleine Helfer
│
└── data/                         Zugriff auf die JSON-Dateien — das Herzstück
    ├── types.ts                  Domänen-Typen (= Format der Dateien in data/)
    ├── json-store.ts             Lesen (fs + Prozess-Cache) und Schreiben (fs | GitHub)
    ├── github.ts                 Contents-API: Datei committen, Workflow anstoßen
    ├── sources.ts                Quellen lesen/anlegen/ändern/löschen
    ├── news.ts                   Items laden/speichern + queryNews() (Filter, Suche)
    ├── settings.ts               App-Einstellungen mit Defaults
    └── push-subscriptions.ts     Push-Geräte, AES-256-GCM-verschlüsselt

data/                             Der Datenbestand, versioniert im Repo
├── sources.json                  Quellen + Abruf-Status
├── news.json                     News-Items
├── settings.json                 App-Einstellungen
├── gemini-usage.json             Tagesverbrauch (30 Tage Historie)
├── gemini-cache.json             Klassifizierungs-Cache
└── push-subscriptions.enc.json   verschlüsselt, entsteht bei der ersten Anmeldung

tests/                            Vitest (127 Tests in 18 Files)
├── adapters/                     RSS, YouTube, Generic, HTML-spezifisch, Google News
├── data/                         queryNews: Filter, Sortierung, Suche
├── lib/                          Categories, Rate-Limit, Content-Extractor, Lang-Detect
├── relevance/                    scoreByKeywords (alle Branches), Topics, Top-News
├── dedup.test.ts
└── time-bucket.test.ts

scripts/
├── pipeline/run.ts               Die Datenpflege — läuft in GitHub Actions
├── seed.ts                       Legt data/ mit den Standard-Quellen an (idempotent)
├── generate-icons.ts             SVG → PNG via sharp
├── reclassify-all.ts             Items neu bewerten (z. B. nach Keyword-Update)
├── purge-irrelevant.ts           Score < 4 löschen
└── verify-data.ts                Datenstand inspizieren

.github/workflows/
├── cron-refresh.yml              Pipeline + Commit (alle 2 h, plus workflow_dispatch)
└── deploy.yml                    Vercel-Deploy-Fallback (manuell)
```

## Setup von Null

### 1. Voraussetzungen

- Node.js 20+ (CI nutzt 22)
- npm 10+
- Vercel-Account, GitHub-Account
- Google AI Studio API-Key (Gemini, kostenlose Tier reicht)

Eine Datenbank wird **nicht** gebraucht.

### 2. Repo klonen + Dependencies

```bash
git clone https://github.com/asteeg79/physionews.git
cd physionews
npm install
```

### 3. Schlüssel erzeugen

```bash
npx web-push generate-vapid-keys   # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
openssl rand -hex 32               # PUSH_STORE_KEY
```

Den GitHub-Token unter *GitHub → Settings → Developer settings → Personal access
tokens → Fine-grained* anlegen, beschränkt auf dieses Repository:

- **Contents: read and write** — damit die App Einstellungen, Quellen und
  Push-Anmeldungen committen kann
- **Actions: write** — damit der Refresh-Knopf die Pipeline anstoßen kann

### 4. `.env.local` anlegen

```bash
cp .env.example .env.local
```

| Variable | Quelle | Wird gebraucht von |
|---|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | GitHub Actions |
| `VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` | GitHub Actions, Vercel |
| `VAPID_PRIVATE_KEY` | s. o. | GitHub Actions, Vercel |
| `VAPID_SUBJECT` | `mailto:deine@email.de` | GitHub Actions, Vercel |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | gleicher Wert wie `VAPID_PUBLIC_KEY` | Vercel |
| `PUSH_STORE_KEY` | `openssl rand -hex 32` | GitHub Actions, Vercel (identisch!) |
| `GITHUB_TOKEN` | Fine-grained PAT, s. Schritt 3 | Vercel |
| `GITHUB_REPO` | z. B. `asteeg79/physionews` | Vercel |

Lokal reicht für die reine Ansicht eine leere `.env.local` — ohne
`GITHUB_TOKEN` schreibt die App direkt ins Dateisystem.

### 5. Datendateien anlegen

```bash
npm run seed          # data/*.json mit den Standard-Quellen
```

Das Skript überschreibt nichts, was schon da ist. Für einen echten Neustart
vorher `rm data/*.json`.

Danach einmal die Pipeline laufen lassen, um Beiträge zu holen:

```bash
npm run pipeline            # alle drei Stufen
npm run pipeline fetch      # oder einzeln
npm run data:verify         # Datenstand ansehen
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

1. Repo zu GitHub pushen — `data/` gehört mit ins Repository, nicht in `.gitignore`.
2. Vercel → Import Repository.
3. **Vercel-GitHub-App** im Repo aktivieren (`https://github.com/apps/vercel` → Configure → Repository-Access). Ohne sie deployt der Push der Pipeline nicht, und die Daten bleiben stehen.
4. **Vercel Environment-Variables** (Production + Preview + Development):
   `GITHUB_TOKEN`, `GITHUB_REPO`, `PUSH_STORE_KEY`, `VAPID_SUBJECT`,
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
   Vercel setzt `VERCEL`, `VERCEL_GIT_COMMIT_SHA` und `VERCEL_GIT_COMMIT_REF` selbst —
   an `VERCEL` erkennt die App, dass sie über die GitHub-API schreiben muss.
5. Erstes Deployment auslösen — `npm run build` mit `--webpack` (siehe `package.json`, wegen `@serwist/next`).
6. **GitHub Actions Secrets** unter *Repo → Settings → Secrets and Variables → Actions*:
   - `GEMINI_API_KEY`
   - `PUSH_STORE_KEY` (**identischer Wert** wie in Vercel)
   - `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
   - Für den Deploy-Fallback-Workflow zusätzlich `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
7. Unter *Settings → Actions → General → Workflow permissions* **„Read and write permissions"** aktivieren — sonst kann der Workflow `data/` nicht committen.
8. Pipeline starten: Tab *Actions* → *PhysioNews Datenpflege* → *Run workflow*.

### Manueller Refresh

```bash
# Lokal — schreibt direkt in data/
npm run pipeline              # alle Stufen
npm run pipeline fetch        # nur abrufen
npm run pipeline classify     # nur bewerten + Push
npm run pipeline maintenance  # nur aufräumen + Top-News

# In GitHub Actions
gh workflow run cron-refresh.yml
```

Lokal geänderte Dateien in `data/` müssen committet und gepusht werden, damit
die App sie ausliefert.

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

### Neue Beiträge erscheinen nicht, obwohl die Action grün ist

Die Pipeline schreibt nur ins Repo — sichtbar werden die Daten erst durch den
Vercel-Deploy. Prüfen:

1. Hat der Workflow wirklich committet? Im Actions-Log steht sonst
   „Keine Datenänderungen — nichts zu committen."
2. Gibt es einen Deploy zu diesem Commit? Im Settings-Footer der App stehen
   Bundle- und Server-Version — ein Mismatch zeigt den Stau sofort.
3. Vercel-GitHub-App noch verbunden? Siehe Abschnitt oben.

### Workflow bricht beim Commit ab („permission denied")

*Repo → Settings → Actions → General → Workflow permissions* auf
**„Read and write permissions"** stellen. Der Workflow deklariert zwar
`permissions: contents: write`, die Repo-Einstellung kann das aber deckeln.

### Einstellungen lassen sich nicht speichern (503)

Die Antwort nennt den Grund. Auf Vercel braucht die App `GITHUB_TOKEN` und
`GITHUB_REPO`, um die Datei zu committen — fehlt eines davon, lehnt die Route
bewusst ab, statt stillschweigend nichts zu tun. Beim Token prüfen, ob es
**Contents: read and write** für genau dieses Repository hat und nicht
abgelaufen ist.

### Push-Anmeldung schlägt mit 503 fehl

`PUSH_STORE_KEY` fehlt. Ohne Schlüssel werden die Subscription-Daten nicht
abgelegt — das Repository ist öffentlich, und Endpoint plus `p256dh`/`auth`
würden im Klartext jedem erlauben, Benachrichtigungen an das Gerät zu schicken.

### Push kommt nicht an, obwohl ein Gerät angemeldet ist

Meistens stimmen die beiden `PUSH_STORE_KEY` nicht überein: die App (Vercel)
verschlüsselt die Datei, die Pipeline (GitHub Actions) entschlüsselt sie. Bei
abweichenden Schlüsseln steht im Actions-Log „Datei konnte nicht entschlüsselt
werden" und die Liste bleibt leer. Nach einer Schlüssel-Änderung müssen sich
die Geräte neu anmelden — die alte Datei ist dann nicht mehr lesbar.

### „outside_window" beim Refresh

Refresh läuft nur im Fenster (Default 06–22 Berlin). Der geplante Lauf
überspringt sich außerhalb; ein manuell ausgelöster Lauf
(`workflow_dispatch`) läuft immer. Kein Fehler.

### Push-Notifications kommen auf iOS nicht an

- PWA muss installiert sein (Standalone, nicht Browser-Tab)
- iOS 16.4+
- *iOS-Settings → Benachrichtigungen → PhysioNews → erlaubt*
- Test-Push in *Settings* ausprobieren

### Build schlägt mit Turbopack-Fehler fehl

Next.js 16 nutzt Turbopack als Default, `@serwist/next` braucht webpack. `package.json` setzt deshalb `"build": "next build --webpack"`. Nicht entfernen.

### „Kein Adapter für Typ X" im Pipeline-Log

Eine Quelle hat in `data/sources.json` einen `adapterType`, der nicht in `src/lib/adapters/registry.ts` registriert ist. Quelle deaktivieren oder Adapter ergänzen + registrieren.

### Gemini-Quota erschöpft

In Settings sichtbar (*KI-Klassifizierung*). Free-Tier hat tagesweise Limits — bei Engpass bleiben Grauzonen-Items beim Keyword-Score; sie werden angezeigt, aber nicht thematisch getaggt. Der Rest bleibt `pending` und kommt im nächsten Lauf dran. Am UTC-Tageswechsel resettet der Zähler automatisch.

## Tests

```bash
npm test           # Vitest run (127 Tests in 18 Files)
npm run test:watch
```

Coverage: Dedup, TimeBucket, Feed-Detect, Lang-Detect, alle Adapter (mit gespeicherten HTML/RSS-Fixtures), Keyword-Scoring (alle Branches inkl. Junk-Filter), Topic-Taxonomie, Top-News-Auswahl, Rate-Limit, Content-Extractor, Kategorien sowie `queryNews` (Filter, Sortierung, Suche) — die Logik, die vorher als SQL-Query in der Datenbank lag.

## Datenschutz

- Keine Tracker, keine Analytics.
- Die Inhaltsdaten (Quellen, Beiträge, Einstellungen) liegen offen im GitHub-Repository. Es sind ausschließlich öffentlich publizierte Nachrichten — nichts davon ist personenbezogen.
- **Push-Subscriptions sind verschlüsselt** (AES-256-GCM, `PUSH_STORE_KEY`). Endpoint plus `p256dh`/`auth` reichen aus, um Benachrichtigungen an das Gerät zu schicken — im Klartext hätten sie in einem öffentlichen Repository nichts verloren.
- Der Lesestand verlässt das Gerät nicht (localStorage).
- Gemini-API-Calls senden Titel + Summary an Google (USA). Für eine private Single-User-App vertretbar; bei Mehrnutzer-Deployment wären Auth + DSGVO-Aufklärung zu ergänzen.

## Lizenz

Privates Projekt. Bei Interesse an Adaption: gerne forken.
