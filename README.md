# PhysioNews

Progressive Web App für Physiotherapeut:innen — aggregiert berufsrelevante Nachrichten aus verschiedenen Quellen (RSS, HTML-Scraper, YouTube) in einer übersichtlichen App.

## Funktionen

- Nachrichten-Aggregation aus 20+ Quellen (Verbände, Recht, Evidenz, Leitlinien)
- Zeitliche Gliederung: Heute / Diese Woche / Diesen Monat / Älter
- Web-Push-Benachrichtigungen bei neuen Inhalten
- Automatischer Refresh alle 2 Stunden (06–22 Uhr Berliner Zeit)
- Offline-fähig (PWA) — installierbar auf iPhone und Desktop
- Vollständig auf Deutsch, Zeitzone Europe/Berlin

## Technologie-Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS + shadcn/ui**
- **Supabase** (PostgreSQL, Region Frankfurt EU)
- **Drizzle ORM**
- **@serwist/next** (Service Worker, Web Push)
- **Hosting:** Vercel (Frontend + API) + GitHub Actions (Cron)

## Setup (Erstinstallation)

### 1. Voraussetzungen

- Node.js 20+
- npm 10+
- Supabase-Account (kostenlos)
- Vercel-Account (kostenlos)
- GitHub-Account (für Cron-Workflow)

### 2. Repository klonen

```bash
git clone <repo-url>
cd physionews
npm install
```

### 3. Supabase-Projekt anlegen

1. [supabase.com](https://supabase.com) → Neues Projekt, Region **Frankfurt (eu-central-1)**
2. **Settings → Database → Connection string → URI** kopieren
3. `DATABASE_URL` in `.env.local` eintragen

### 4. Umgebungsvariablen anlegen

```bash
cp .env.example .env.local
```

`.env.local` befüllen:

| Variable | Wo zu finden |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → URI |
| `VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | s.o. |
| `VAPID_SUBJECT` | Deine E-Mail-Adresse |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Gleicher Wert wie `VAPID_PUBLIC_KEY` |
| `CRON_SECRET` | Selbst gewählter Zufallsstring |

### 5. VAPID-Keys generieren

```bash
npx web-push generate-vapid-keys
```

Output in `.env.local` eintragen.

### 6. Datenbank migrieren

```bash
npm run db:generate
npm run db:migrate
```

### 7. Seed-Daten einspielen

```bash
npm run seed
```

Legt die 20+ Default-Quellen und App-Einstellungen an.

### 8. Lokale Entwicklung

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000)

---

## Deployment auf Vercel

1. **GitHub-Repository erstellen** und Code pushen
2. **Vercel** → Import Repository
3. **Environment Variables** auf Vercel setzen (gleiche wie `.env.local`)
4. **GitHub Actions Secrets** setzen:
   - `CRON_SECRET` (gleicher Wert wie in Vercel)
   - `APP_DOMAIN` (z.B. `physionews.vercel.app`)
5. **Erstes Deployment** abwarten
6. **Seed ausführen** (wenn nicht bereits lokal geschehen):
   ```bash
   npx vercel env pull && npm run seed
   ```

### Manueller Cron-Test

```bash
curl -X POST \
  -H "X-Cron-Secret: DEIN_CRON_SECRET" \
  https://physionews.vercel.app/api/cron/refresh
```

---

## iOS-Installation (PWA)

1. App-URL in **Safari** öffnen (nicht Chrome!)
2. **Teilen-Symbol** antippen (Rechteck mit Pfeil)
3. **„Zum Home-Bildschirm"** auswählen
4. Nach der Installation: **Push-Erlaubnis erteilen**

> **Wichtig:** Web-Push auf iOS funktioniert erst nach der Installation als PWA. iOS 16.4+ erforderlich.

---

## App-Icons

Icons müssen manuell in `/public/icons/` abgelegt werden:

| Datei | Größe | Verwendung |
|---|---|---|
| `icon-192.png` | 192×192 | Android / PWA |
| `icon-512.png` | 512×512 | Android / PWA |
| `icon-maskable-512.png` | 512×512 | Android adaptiv |
| `apple-touch-icon.png` | 180×180 | iOS |

Tool-Empfehlung: [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)

---

## Neue RSS-Quelle hinzufügen

1. In der App: **Einstellungen → Quellen → Quelle hinzufügen**
2. RSS-URL eingeben — die App erkennt automatisch RSS/Atom-Feeds
3. Kategorie wählen und speichern

---

## Troubleshooting

### "outside_window" beim Cron-Aufruf

Der Refresh findet nur zwischen 06:00 und 22:00 Uhr (Europe/Berlin) statt. Außerhalb dieser Zeiten gibt der Endpoint `{ skipped: true }` zurück — das ist kein Fehler.

### Push-Notifications kommen nicht an (iOS)

- Ist die App als PWA installiert (nicht im Browser geöffnet)?
- iOS 16.4 oder neuer?
- Push-Erlaubnis in iOS-Einstellungen für PhysioNews aktiv?

### "Kein Adapter für Typ..." im Cron-Log

Ein Eintrag in der `sources`-Tabelle hat einen unbekannten `adapter_type`. Entweder die Quelle deaktivieren oder den richtigen Typ aus der Registry eintragen.

### TypeScript-Fehler nach Update

```bash
npm run build
```

zeigt alle Fehler. Häufigste Ursache: neue Drizzle-API-Version.

---

## Entwicklungsphasen

| Phase | Status | Inhalt |
|---|---|---|
| 1 | ✅ | Projekt-Setup, Schema, Seed, Basis-UI |
| 2 | ⏳ | RSS/YouTube-Adapter, echte Daten |
| 3 | ⏳ | HTML-Scraper pro Quelle |
| 4 | ⏳ | Cron & Web Push |
| 5 | ⏳ | Settings & Quellen-Management |
| 6 | ⏳ | PWA-Polish, Icons, Lighthouse |
| 7 | ⏳ | Optionaler Passwortschutz |

---

## Quellen-Hinweise

Einige HTML-Quellen benötigen möglicherweise JavaScript-Rendering und sind mit `// TODO: JS-Rendering` markiert. Diese werden in Phase 3 einzeln geprüft. Quellen mit verstecktem RSS-Feed im `<head>` werden auf den RSS-Adapter umgestellt.

## Datenschutz

- Keine Dritt-Tracker, keine Analytics
- Push-Subscriptions enthalten Endpoints zu Apple/Google — technisch unvermeidbar, für eine private Single-User-App akzeptabel
- Alle Daten liegen auf Supabase (EU-Frankfurt) und Vercel
