/**
 * Legt die Datendateien in `data/` mit den Standard-Quellen an.
 *
 * Idempotent: vorhandene Dateien werden nicht überschrieben. Für einen
 * kompletten Neustart die Dateien vorher löschen.
 *
 *   npm run seed
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');

interface SeedSource {
  name: string;
  url: string;
  adapterType: string;
  category: string;
  iconName: string;
  /** Default true — BARMER ist bewusst aus (zu allgemein-politisch). */
  isEnabled?: boolean;
}

const DEFAULT_SOURCES: SeedSource[] = [
  // --- Berufspolitik / Verbände ---
  { name: 'VPT NRW Aktuelles', url: 'https://vpt-nrw.de/aktuelles/newsarchiv/', adapterType: 'html:vpt-nrw', category: 'berufspolitik', iconName: 'building-2' },
  { name: 'VPT Bundesverband', url: 'https://www.vpt.de/', adapterType: 'html:vpt', category: 'berufspolitik', iconName: 'building-2' },
  { name: 'IFK Aktuelles', url: 'https://www.ifk.de/verband/aktuelles', adapterType: 'html:ifk', category: 'berufspolitik', iconName: 'users' },
  { name: 'Physio Deutschland (ZVK)', url: 'https://www.physio-deutschland.de/fachkreise/news-bundesweit.html', adapterType: 'html:physioDeutschland', category: 'berufspolitik', iconName: 'activity' },
  { name: 'VDB Physiotherapieverband NRW', url: 'https://physio.nrw/', adapterType: 'html:vdbNrw', category: 'berufspolitik', iconName: 'map-pin' },

  // --- Recht & Abrechnung ---
  { name: 'RA Benjamin Alt — Aktuelles', url: 'https://www.rechtsanwaltalt.de/aktuelles/', adapterType: 'html:raAlt', category: 'recht', iconName: 'scale' },
  { name: 'RA Benjamin Alt — Artikel', url: 'https://www.rechtsanwaltalt.de/artikel/', adapterType: 'html:raAlt', category: 'recht', iconName: 'file-text' },
  { name: 'RA Benjamin Alt — YouTube', url: 'https://www.youtube.com/@RechtsanwaltAlt', adapterType: 'youtube', category: 'recht', iconName: 'youtube' },
  { name: 'G-BA Pressemitteilungen', url: 'https://www.g-ba.de/presse/pressemitteilungen/', adapterType: 'html:gba', category: 'recht', iconName: 'landmark' },
  { name: 'BMG Pressemitteilungen', url: 'https://www.bundesgesundheitsministerium.de/presse/pressemitteilungen', adapterType: 'html:bmg', category: 'recht', iconName: 'landmark' },

  // --- Evidenz, Forschung & Fachpresse ---
  { name: 'Physio.de Newsletter-Archiv', url: 'https://physio.de/community/news/archiv/99', adapterType: 'html:physioDe', category: 'evidenz', iconName: 'newspaper' },
  { name: 'Thieme physioscience (RSS)', url: 'https://www.thieme-connect.de/rss/thieme/en/10.1055-s-00000128.xml', adapterType: 'rss', category: 'evidenz', iconName: 'book-open' },
  { name: 'Thieme Journal KG/Manuelle Therapie', url: 'https://www.thieme-connect.de/rss/thieme/de/10.1055-s-00000162.xml', adapterType: 'rss', category: 'evidenz', iconName: 'book-open' },
  { name: 'physiotherapeuten.de — Wirbelsäule', url: 'https://physiotherapeuten.de/themen/orthopaedie-chirurgie/orthopaedie-chirurgie_wirbelsaeule/', adapterType: 'html:physiotherapeutenDe', category: 'evidenz', iconName: 'activity' },
  { name: 'physiotherapeuten.de — untere Extremität', url: 'https://physiotherapeuten.de/themen/orthopaedie-chirurgie/orthopaedie-chirurgie_untere-extremitaet/', adapterType: 'html:physiotherapeutenDe', category: 'evidenz', iconName: 'activity' },
  { name: 'physiotherapeuten.de — obere Extremität', url: 'https://physiotherapeuten.de/themen/orthopaedie-chirurgie/orthopaedie-chirurgie_obere-extremitaet/', adapterType: 'html:physiotherapeutenDe', category: 'evidenz', iconName: 'activity' },
  { name: 'Cochrane Deutschland — News', url: 'https://www.cochrane.de/news', adapterType: 'html:cochrane', category: 'evidenz', iconName: 'microscope' },
  { name: 'DGSP — News', url: 'https://www.dgsp.de/news/', adapterType: 'html:dgsp', category: 'evidenz', iconName: 'dumbbell' },

  // --- Allgemein ---
  { name: 'Robert Koch-Institut Pressemitteilungen', url: 'https://www.rki.de/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/meldungen-pressemitteilungen-node.html', adapterType: 'html:rki', category: 'evidenz', iconName: 'shield' },

  // --- Später ergänzte Fachquellen (vormals scripts/add-new-sources.ts) ---
  { name: 'AOK WIdO — News & Presse', url: 'https://www.wido.de/news-presse/', adapterType: 'html:generic', category: 'berufspolitik', iconName: 'newspaper' },
  { name: 'BARMER Presseinformationen', url: 'https://www.barmer.de/presse/presseinformationen', adapterType: 'html:generic', category: 'berufspolitik', iconName: 'newspaper', isEnabled: false },
  { name: 'DGOU Pressemitteilungen', url: 'https://dgou.de/presse/pressemitteilungen/', adapterType: 'html:generic', category: 'evidenz', iconName: 'newspaper' },
  {
    name: 'physiotherapeuten.de (via Google News)',
    // Die Seite sperrt Scraper aus (Brightboy) und verbietet es per robots.txt,
    // lässt Google aber als News-Indexer zu — dafür ist der Proxy gedacht.
    // Entspricht buildGoogleNewsUrl('site:physiotherapeuten.de'); hier
    // ausgeschrieben, damit das Seed-Skript ohne App-Importe auskommt.
    url: 'https://news.google.com/rss/search?q=' + encodeURIComponent('site:physiotherapeuten.de') + '&hl=de&gl=DE&ceid=DE:de',
    adapterType: 'google-news',
    category: 'evidenz',
    iconName: 'newspaper',
  },
];

const DEFAULT_SETTINGS = {
  refreshIntervalHours: 2,
  refreshWindowStart: 6,
  refreshWindowEnd: 22,
  retentionDays: 30,
  minRelevance: 7,
  maxItemsPerSource: 8,
  notificationsEnabled: true,
  lastGlobalRefreshAt: null,
};

async function exists(file: string): Promise<boolean> {
  try {
    await access(path.join(DATA_DIR, file));
    return true;
  } catch {
    return false;
  }
}

async function writeIfMissing(file: string, value: unknown): Promise<void> {
  if (await exists(file)) {
    console.log(`⏭️  ${file} existiert bereits — unverändert.`);
    return;
  }
  await writeFile(path.join(DATA_DIR, file), `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  console.log(`✅  ${file} angelegt.`);
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  const now = new Date().toISOString();
  const sources = DEFAULT_SOURCES.map((s) => ({
    id: randomUUID(),
    name: s.name,
    url: s.url,
    adapterType: s.adapterType,
    category: s.category,
    iconName: s.iconName,
    isEnabled: s.isEnabled ?? true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: now,
  }));

  await writeIfMissing('sources.json', sources);
  await writeIfMissing('settings.json', DEFAULT_SETTINGS);
  await writeIfMissing('news.json', []);
  await writeIfMissing('gemini-usage.json', []);
  await writeIfMissing('gemini-cache.json', []);

  console.log(`\nFertig — ${sources.length} Quellen im Seed.`);
}

main().catch((err) => {
  console.error('Seed fehlgeschlagen:', err);
  process.exit(1);
});
