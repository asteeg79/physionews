import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db, schema } = await import('../src/db');
  const { eq, like } = await import('drizzle-orm');
  const { buildGoogleNewsUrl } = await import('../src/lib/adapters/google-news');
  void schema;

  // 1. Alte physiotherapeuten.de-Quellen finden
  const existing = await db
    .select()
    .from(schema.sources)
    .where(like(schema.sources.name, 'physiotherapeuten.de%'));

  console.log(`Gefunden: ${existing.length} bestehende Einträge`);
  for (const s of existing) {
    console.log(`  - ${s.name} (enabled=${s.isEnabled})`);
  }

  // 2. Neue Konfiguration:
  //    Drei Themenbereiche analog zur ursprünglichen Konfiguration +
  //    ein zusätzlicher "Neurologie & Sport"-Block.
  const newConfig = [
    {
      name: 'physiotherapeuten.de — Wirbelsäule (via Google News)',
      query: 'site:physiotherapeuten.de (wirbelsäule OR rücken OR LWS OR HWS OR BWS OR bandscheibe OR skoliose OR ISG)',
    },
    {
      name: 'physiotherapeuten.de — untere Extremität (via Google News)',
      query: 'site:physiotherapeuten.de (knie OR hüfte OR sprunggelenk OR fuß OR achilles OR meniskus OR kreuzband OR TEP)',
    },
    {
      name: 'physiotherapeuten.de — obere Extremität (via Google News)',
      query: 'site:physiotherapeuten.de (schulter OR ellenbogen OR hand OR handgelenk OR rotatorenmanschette OR impingement)',
    },
    {
      name: 'physiotherapeuten.de — Neurologie & Sport (via Google News)',
      query: 'site:physiotherapeuten.de (schlaganfall OR parkinson OR MS OR querschnitt OR sport OR athletik)',
    },
  ];

  // 3. Alle alten physiotherapeuten.de-Quellen löschen, neue anlegen
  if (existing.length > 0) {
    for (const s of existing) {
      await db.delete(schema.sources).where(eq(schema.sources.id, s.id));
    }
    console.log(`\n${existing.length} alte Quellen gelöscht.`);
  }

  for (const cfg of newConfig) {
    const url = buildGoogleNewsUrl(cfg.query);
    await db.insert(schema.sources).values({
      name: cfg.name,
      url,
      adapterType: 'google-news',
      category: 'evidenz' as const,
      iconName: 'newspaper',
      isEnabled: true,
      notificationsEnabled: true,
    });
    console.log(`✅ angelegt: ${cfg.name}`);
    console.log(`   URL: ${url.slice(0, 100)}...`);
  }

  console.log('\nFertig. Beim nächsten Refresh werden die Quellen abgerufen.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
