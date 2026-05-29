/**
 * Einmaliges Setup-Script: fügt die 5 neuen Fachquellen hinzu.
 * Die meisten haben keinen eigenen RSS-Feed, deshalb html:generic.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db, schema } = await import('../src/db');
  const { eq } = await import('drizzle-orm');
  const { buildGoogleNewsUrl } = await import('../src/lib/adapters/google-news');
  void schema;

  const newSources = [
    {
      name: 'AOK WIdO — News & Presse',
      url: 'https://www.wido.de/news-presse/',
      adapterType: 'html:generic',
      category: 'fachlich' as const,
      iconName: 'newspaper',
    },
    {
      name: 'BARMER Presseinformationen',
      url: 'https://www.barmer.de/presse/presseinformationen',
      adapterType: 'html:generic',
      category: 'gesetz' as const,
      iconName: 'newspaper',
    },
    {
      name: 'DGOU Pressemitteilungen',
      url: 'https://dgou.de/presse/pressemitteilungen/',
      adapterType: 'html:generic',
      category: 'fachlich' as const,
      iconName: 'newspaper',
    },
    {
      name: 'Springer Manuelle Medizin (Updates)',
      url: 'https://link.springer.com/journal/337/updates',
      adapterType: 'html:generic',
      category: 'fachlich' as const,
      iconName: 'newspaper',
    },
    {
      name: 'pt-online.de (via Google News)',
      url: buildGoogleNewsUrl('site:pt-online.de'),
      adapterType: 'google-news',
      category: 'fachlich' as const,
      iconName: 'newspaper',
    },
  ];

  for (const cfg of newSources) {
    const existing = await db.select().from(schema.sources).where(eq(schema.sources.name, cfg.name));
    if (existing.length > 0) {
      console.log(`⚠️  bereits vorhanden: ${cfg.name}`);
      continue;
    }
    await db.insert(schema.sources).values({
      ...cfg,
      isEnabled: true,
      notificationsEnabled: true,
    });
    console.log(`✅  angelegt: ${cfg.name}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
