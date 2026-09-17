/**
 * Bewertet ALLE News-Items neu — auch die bereits klassifizierten.
 * Setzt `relevanceMethod` auf `pending` zurück und lässt die Pipeline
 * erneut darüberlaufen.
 *
 *   npx tsx scripts/reclassify-all.ts
 */
import { config } from 'dotenv';

// Lokal kommen die Keys aus .env.local; in GitHub Actions gibt es die
// Datei nicht und die Werte stehen bereits in der Umgebung.
config({ path: '.env.local' });

import { classifyPendingItems, resetAllToPending, relevanceStats } from '../src/lib/relevance';

/** Items pro Runde — hält die Gemini-Batches und den Speicher überschaubar. */
const CHUNK = 200;
const MAX_ROUNDS = 25;

async function main(): Promise<void> {
  const total = await resetAllToPending();
  console.log(`${total} Items auf pending zurückgesetzt.\n`);

  let classified = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const result = await classifyPendingItems(CHUNK);
    if (result.total === 0) {
      console.log(`Runde ${round}: nichts mehr zu tun.`);
      break;
    }
    classified += result.total;
    console.log(
      `Runde ${round}: ${result.total} bewertet ` +
        `(keyword: ${result.byMethod.keyword}, ai: ${result.byMethod.ai}, ` +
        `accept: ${result.byDecision.accept}, gray: ${result.byDecision.gray}, ` +
        `reject: ${result.byDecision.reject}, gelöscht: ${result.deletedBelowThreshold}, ` +
        `Gemini-Batches: ${result.geminiBatches}, ~${result.geminiTokensEstimated} Tokens)`
    );
    if (result.quotaThrottled) {
      console.log('Gemini-Quota erschöpft — Rest bleibt pending.');
      break;
    }
    if (result.remaining === 0) break;
  }

  console.log(`\n✅ Insgesamt ${classified} Items neu bewertet.\n`);
  console.log('Verteilung (Score / Methode → Anzahl):');
  for (const row of await relevanceStats()) {
    console.log(`  ${row.score} (${row.method}): ${row.count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
