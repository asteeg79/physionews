import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sources, appSettings } from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const defaultSources = [
  // --- Berufspolitik / Verbände ---
  {
    name: 'VPT NRW Aktuelles',
    url: 'https://vpt-nrw.de/aktuelles/',
    adapterType: 'html:vpt-nrw',
    category: 'berufspolitik' as const,
    iconName: 'building-2',
  },
  {
    name: 'VPT Bundesverband',
    url: 'https://www.vpt.de/',
    adapterType: 'html:vpt',
    category: 'berufspolitik' as const,
    iconName: 'building-2',
  },
  {
    name: 'IFK Aktuelles',
    url: 'https://www.ifk.de/verband/aktuelles',
    adapterType: 'html:ifk',
    category: 'berufspolitik' as const,
    iconName: 'users',
  },
  {
    name: 'Physio Deutschland (ZVK)',
    url: 'https://www.physio-deutschland.de/fachkreise/news-bundesweit.html',
    adapterType: 'html:physioDeutschland',
    category: 'berufspolitik' as const,
    iconName: 'activity',
  },
  {
    name: 'VDB Physiotherapieverband NRW',
    url: 'https://physio.nrw/',
    adapterType: 'html:vdbNrw',
    category: 'berufspolitik' as const,
    iconName: 'map-pin',
  },

  // --- Recht & Abrechnung ---
  {
    name: 'RA Benjamin Alt — Aktuelles',
    url: 'https://www.rechtsanwaltalt.de/aktuelles/',
    adapterType: 'html:raAlt',
    category: 'recht' as const,
    iconName: 'scale',
  },
  {
    name: 'RA Benjamin Alt — Artikel',
    url: 'https://www.rechtsanwaltalt.de/artikel/',
    adapterType: 'html:raAlt',
    category: 'recht' as const,
    iconName: 'file-text',
  },
  {
    name: 'RA Benjamin Alt — YouTube',
    url: 'https://www.youtube.com/@RechtsanwaltAlt',
    adapterType: 'youtube',
    category: 'recht' as const,
    iconName: 'youtube',
  },
  {
    name: 'G-BA Pressemitteilungen',
    url: 'https://www.g-ba.de/presse/pressemitteilungen/',
    adapterType: 'html:gba',
    category: 'recht' as const,
    iconName: 'landmark',
  },

  // --- Evidenz, Forschung & Fachpresse ---
  {
    name: 'Physio.de Newsletter-Archiv',
    url: 'https://physio.de/community/news/archiv/99',
    adapterType: 'html:physioDe',
    category: 'evidenz' as const,
    iconName: 'newspaper',
  },
  {
    name: 'Thieme physioscience (RSS)',
    url: 'https://www.thieme-connect.de/rss/thieme/en/10.1055-s-00000128.xml',
    adapterType: 'rss',
    category: 'evidenz' as const,
    iconName: 'book-open',
  },
  {
    name: 'Thieme Journal KG/Manuelle Therapie',
    url: 'https://www.thieme-connect.de/products/ejournals/journal/10.1055/s-00000162',
    adapterType: 'html:thiemeJournal',
    category: 'evidenz' as const,
    iconName: 'book-open',
  },
  {
    name: 'physiotherapeuten.de — Wirbelsäule',
    url: 'https://physiotherapeuten.de/themen/orthopaedie-chirurgie/orthopaedie-chirurgie_wirbelsaeule/',
    adapterType: 'html:physiotherapeutenDe',
    category: 'evidenz' as const,
    iconName: 'activity',
  },
  {
    name: 'physiotherapeuten.de — untere Extremität',
    url: 'https://physiotherapeuten.de/themen/orthopaedie-chirurgie/orthopaedie-chirurgie_untere-extremitaet/',
    adapterType: 'html:physiotherapeutenDe',
    category: 'evidenz' as const,
    iconName: 'activity',
  },
  {
    name: 'physiotherapeuten.de — obere Extremität',
    url: 'https://physiotherapeuten.de/themen/orthopaedie-chirurgie/orthopaedie-chirurgie_obere-extremitaet/',
    adapterType: 'html:physiotherapeutenDe',
    category: 'evidenz' as const,
    iconName: 'activity',
  },
  {
    name: 'Cochrane Deutschland — News',
    url: 'https://www.cochrane.de/news',
    adapterType: 'html:cochrane',
    category: 'evidenz' as const,
    iconName: 'microscope',
  },
  {
    name: 'Cochrane für Physiotherapeuten',
    url: 'https://www.cochrane.de/zusammenfassungen-physiotherapeuten',
    adapterType: 'html:cochrane',
    category: 'evidenz' as const,
    iconName: 'microscope',
  },

  // --- Leitlinien ---
  {
    name: 'AWMF Leitlinien (aktuell)',
    url: 'https://www.awmf.org/leitlinien/aktuelle-leitlinien',
    adapterType: 'html:awmf',
    category: 'leitlinien' as const,
    iconName: 'clipboard-list',
  },

  // --- Allgemein ---
  {
    name: 'Robert Koch-Institut Pressemitteilungen',
    url: 'https://www.rki.de/SharedDocs/Pressemitteilungen/DE/_inhalt.html',
    adapterType: 'html:rki',
    category: 'allgemein' as const,
    iconName: 'shield',
  },
  {
    name: 'BMG Pressemitteilungen',
    url: 'https://www.bundesgesundheitsministerium.de/presse/pressemitteilungen',
    adapterType: 'html:bmg',
    category: 'recht' as const,
    iconName: 'landmark',
  },
  {
    name: 'DGSP — News',
    url: 'https://www.dgsp.de/news/',
    adapterType: 'html:dgsp',
    category: 'evidenz' as const,
    iconName: 'dumbbell',
  },
  {
    name: 'DVMT — Aktuelles',
    url: 'https://dvmt.org/aktuelles/',
    adapterType: 'html:dvmt',
    category: 'fortbildung' as const,
    iconName: 'graduation-cap',
  },
];

async function seed() {
  console.log('Seeding Datenbank...');

  // Default App-Einstellungen (Singleton-Row)
  await db
    .insert(appSettings)
    .values({ id: 1 })
    .onConflictDoNothing();

  console.log('App-Einstellungen angelegt.');

  // Quellen einfügen (überspringen wenn bereits vorhanden)
  let neu = 0;
  for (const source of defaultSources) {
    await db
      .insert(sources)
      .values(source)
      .onConflictDoNothing();
    neu++;
  }

  console.log(`${neu} Quellen angelegt (Duplikate übersprungen).`);
  console.log('Seed abgeschlossen.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed fehlgeschlagen:', err);
  process.exit(1);
});
