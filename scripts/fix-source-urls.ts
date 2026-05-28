import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1, prepare: false });

async function main() {
  // URL-Updates
  await sql`UPDATE sources SET url = ${'https://register.awmf.org/de/leitlinien/aktuelle-leitlinien'} WHERE name = 'AWMF Leitlinien (aktuell)'`;
  await sql`UPDATE sources SET url = ${'https://www.rki.de/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/meldungen-pressemitteilungen-node.html'} WHERE name = 'Robert Koch-Institut Pressemitteilungen'`;
  await sql`UPDATE sources SET url = ${'https://www.dvmt.de/'} WHERE name = 'DVMT — Aktuelles'`;

  // physiotherapeuten.de blockt aktiv Scraping — deaktivieren (Phase 3 ggf. mit Browser-Engine)
  await sql`UPDATE sources SET is_enabled = false, last_error = 'Site blockt Scraping (HTTP 503). Benötigt JS-Rendering oder Cookies.' WHERE name LIKE 'physiotherapeuten.de%'`;

  const updated = await sql`SELECT name, url, is_enabled FROM sources WHERE name LIKE '%AWMF%' OR name LIKE '%RKI%' OR name LIKE '%RKI%' OR name LIKE '%DVMT%' OR name LIKE 'physiotherapeuten%' OR name LIKE 'Robert Koch%' ORDER BY name`;
  console.log('Aktualisierte Quellen:');
  for (const row of updated) {
    console.log(`  ${row.is_enabled ? '✅' : '⏸️ '} ${row.name}`);
    console.log(`     → ${row.url}`);
  }

  await sql.end();
}

main();
