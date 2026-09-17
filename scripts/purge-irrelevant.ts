/**
 * Löscht alle News-Items unterhalb des Relevanz-Schwellwerts aus
 * `data/news.json`.
 *
 *   npx tsx scripts/purge-irrelevant.ts
 */
import { config } from 'dotenv';

// Lokal kommen die Keys aus .env.local; in GitHub Actions gibt es die
// Datei nicht und die Werte stehen bereits in der Umgebung.
config({ path: '.env.local' });

import { purgeBelowThreshold, MIN_RELEVANCE_THRESHOLD } from '../src/lib/relevance';
import { loadNews } from '../src/data/news';

async function main(): Promise<void> {
  console.log(`Lösche Items mit relevanceScore < ${MIN_RELEVANCE_THRESHOLD}...`);
  const deleted = await purgeBelowThreshold();
  console.log(`✅ ${deleted} Items gelöscht.`);
  console.log(`Verbleibend: ${(await loadNews()).length} Items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
