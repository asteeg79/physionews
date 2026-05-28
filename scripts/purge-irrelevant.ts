import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { purgeBelowThreshold, MIN_RELEVANCE_THRESHOLD } = await import(
    '../src/lib/relevance'
  );

  console.log(`Lösche Items mit relevance_score < ${MIN_RELEVANCE_THRESHOLD}...`);
  const deleted = await purgeBelowThreshold();
  console.log(`✅ ${deleted} Items gelöscht.`);

  const { db, schema } = await import('../src/db');
  const { sql } = await import('drizzle-orm');
  void schema;
  const remaining = await db.execute(sql`SELECT COUNT(*)::int as n FROM news_items`);
  const row = (remaining as unknown as Array<{ n: number }>)[0];
  console.log(`Verbleibend: ${row.n} Items in der DB.`);

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
