import { config } from 'dotenv';
config({ path: '.env.local' });

// Mapping pro Source-Name auf die drei neuen Kategorien
// 'fachlich' — Studien, Leitlinien, Methoden, klinische Themen
// 'gesetz'   — Heilmittelversorgung, GKV-Richtlinien, Rechtsfragen
// 'politik'  — Berufsverband-Politik, allgemeine Gesundheitspolitik
const MAPPING: Record<string, 'fachlich' | 'gesetz' | 'politik'> = {
  // Verbände — Berufspolitik
  'VPT Bundesverband': 'politik',
  'VPT NRW Aktuelles': 'politik',
  'VDB Physiotherapieverband NRW': 'politik',
  'IFK Aktuelles': 'politik',
  'Physio Deutschland (ZVK)': 'politik',
  'DVMT — Aktuelles': 'politik',

  // Recht & Heilmittelversorgung
  'RA Benjamin Alt — Aktuelles': 'gesetz',
  'RA Benjamin Alt — Artikel': 'gesetz',
  'RA Benjamin Alt — YouTube': 'gesetz',
  'G-BA Pressemitteilungen': 'gesetz',
  'BMG Pressemitteilungen': 'gesetz',

  // Fachliche / Wissenschaftliche Quellen
  'physio.de Newsletter-Archiv': 'fachlich',
  'Thieme physioscience (RSS)': 'fachlich',
  'Thieme Journal KG/Manuelle Therapie': 'fachlich',
  'Thieme Newsletter Landing': 'fachlich',
  'Cochrane Deutschland — News': 'fachlich',
  'Cochrane für Physiotherapeuten': 'fachlich',
  'Ärzteblatt RSS Übersicht': 'fachlich',
  'AWMF Leitlinien (aktuell)': 'fachlich',
  'DGSP — News': 'fachlich',
  'physiotherapeuten.de — Wirbelsäule (via Google News)': 'fachlich',
  'physiotherapeuten.de — untere Extremität (via Google News)': 'fachlich',
  'physiotherapeuten.de — obere Extremität (via Google News)': 'fachlich',
  'physiotherapeuten.de — Neurologie & Sport (via Google News)': 'fachlich',

  // RKI ist eher politik/allgemein, würde aber bei strikter Filterung wenig durchkommen
  'Robert Koch-Institut Pressemitteilungen': 'politik',
};

async function main() {
  const { db, schema } = await import('../src/db');
  const { eq } = await import('drizzle-orm');

  const sources = await db.select().from(schema.sources);
  console.log(`Mappe ${sources.length} Quellen...`);

  let mapped = 0;
  let unmapped: string[] = [];
  for (const s of sources) {
    const newCat = MAPPING[s.name];
    if (!newCat) {
      unmapped.push(s.name);
      continue;
    }
    await db
      .update(schema.sources)
      .set({ category: newCat })
      .where(eq(schema.sources.id, s.id));
    mapped++;
    console.log(`  ${s.name.slice(0, 60).padEnd(60)} → ${newCat}`);
  }

  console.log(`\n${mapped} gemappt, ${unmapped.length} nicht zugeordnet.`);
  if (unmapped.length > 0) {
    console.log('Nicht gemappt (Default = fachlich):');
    for (const n of unmapped) {
      await db
        .update(schema.sources)
        .set({ category: 'fachlich' })
        .where(eq(schema.sources.name, n));
      console.log(`  ${n}`);
    }
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
