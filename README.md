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
Browser (iOS Safari, Chrome, Firefox)
   ↓
   ├── Next.js App Router  ─→  Service Worker (Serwist)
   │                                ├── Precache statischer Assets
   │                                ├── Runtime-Cache /api/news (SWR)
   │                                ├── /offline-Fallback
   │                                └── Push-Empfang
   │
   └── API Routes
         ├── GET  /api/news                     Frontend-Daten
         ├── POST /api/cron/refresh             ← GitHub Actions (X-Cron-Secret)
         ├── POST /api/refresh-on-demand        ← App-Open (Rate-Limit 1/5min)
         ├── POST /api/push/{subscribe,unsubscribe,test}
         ├── GET/PATCH /api/settings
         ├── GET/POST /api/sources, /api/sources/[id]
         ├── POST /api/news/mark-all-read
         └── POST /api/cache/clear
              ↓
              FeedFetcher (12 spezifische + 1 Generic-Adapter)
                ↓
                Supabase Postgres
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
