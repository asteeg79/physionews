/**
 * Re-Klassifiziert ALLE bestehenden News-Items (auch bereits klassifizierte).
 * Setzt relevance_method auf 'pending' zurück und ruft die Pipeline auf.
 *
 * WICHTIG: dotenv muss VOR den Modul-Importen laufen, da src/db/index.ts
 * beim Modul-Laden die DATABASE_URL liest.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Dynamische Imports — erst nach dotenv-Setup
  const { db, schema } = await import('../src/db');
  const { sql } = await import('drizzle-orm');
  const { classifyPendingItems } = await import('../src/lib/relevance');
  void schema;

  console.log('Setze alle Items auf method=pending...');
  await db.execute(sql`UPDATE news_items SET relevance_method = 'pending'::relevance_method`);

  console.log('Starte Klassifizierung (max 500 pro Runde, mehrere Runden)...\n');
  let totalClassified = 0;
  for (let round = 1; round <= 10; round++) {
    const result = await classifyPendingItems();
    if (result.total === 0) {
      console.log(`Runde ${round}: nichts mehr zu tun.`);
      break;
    }
    totalClassified += result.total;
    console.log(
      `Runde ${round}: ${result.total} klassifiziert ` +
        `(keyword: ${result.byMethod.keyword}, ai: ${result.byMethod.ai}, ` +
        `accept: ${result.byDecision.accept}, gray: ${result.byDecision.gray}, reject: ${result.byDecision.reject}, ` +
        `gemini batches: ${result.geminiBatches}, ~tokens: ${result.geminiTokensEstimated})`
    );
  }

  console.log(`\n✅ Insgesamt ${totalClassified} Items neu klassifiziert.\n`);

  // Statistik
  const stats = await db.execute(
    sql`SELECT relevance_score::int as score, relevance_method::text as method, COUNT(*)::int as n FROM news_items GROUP BY relevance_score, relevance_method ORDER BY relevance_score DESC, method`
  );
  console.log('Verteilung (Score / Method → Anzahl):');
  for (const row of stats as unknown as Array<{ score: number; method: string; n: number }>) {
    console.log(`  ${row.score} (${row.method}): ${row.n}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
