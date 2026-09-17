/**
 * Zeigt den Inhalt der Datendateien in `data/` — schneller Blick darauf,
 * ob Seed und Pipeline getan haben, was sie sollen.
 *
 *   npx tsx scripts/verify-data.ts
 */
import { config } from 'dotenv';

// Lokal kommen die Keys aus .env.local; in GitHub Actions gibt es die
// Datei nicht und die Werte stehen bereits in der Umgebung.
config({ path: '.env.local' });

import { listSources } from '../src/data/sources';
import { loadNews } from '../src/data/news';
import { getSettings } from '../src/data/settings';
import { listPushSubscriptions, isPushStoreConfigured } from '../src/data/push-subscriptions';
import { getQuotaStatus } from '../src/lib/relevance/gemini-quota';

async function main(): Promise<void> {
  const sources = await listSources();
  const news = await loadNews();
  const settings = await getSettings();

  console.log(`Quellen gesamt: ${sources.length} (${sources.filter((s) => s.isEnabled).length} aktiv)`);

  const byCategory = new Map<string, number>();
  for (const s of sources) byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
  console.log('Nach Kategorie:');
  for (const [category, count] of [...byCategory].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  ${category}: ${count}`);
  }

  const withError = sources.filter((s) => s.lastError);
  if (withError.length > 0) {
    console.log(`\nQuellen mit letztem Fehler: ${withError.length}`);
    for (const s of withError) console.log(`  ${s.name}: ${s.lastError}`);
  }

  console.log(`\nNews-Items: ${news.length}`);
  console.log(`  davon offen (pending): ${news.filter((n) => n.relevanceMethod === 'pending').length}`);
  console.log(`  davon Top-News: ${news.filter((n) => n.isTopNews).length}`);

  if (isPushStoreConfigured()) {
    console.log(`\nPush-Subscriptions: ${(await listPushSubscriptions()).length}`);
  } else {
    console.log('\nPush-Subscriptions: PUSH_STORE_KEY nicht gesetzt — nicht lesbar.');
  }

  const quota = await getQuotaStatus();
  console.log(
    `\nGemini heute (${quota.date}): ${quota.tokensUsed} Tokens, ${quota.requestsMade} Requests.`
  );

  console.log('\nEinstellungen:', settings);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
