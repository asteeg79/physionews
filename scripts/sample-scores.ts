import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  for (const scoreRange of [[10, 10], [8, 9], [6, 7], [4, 5], [2, 3], [0, 1]]) {
    const [min, max] = scoreRange;
    const rows = await db.execute(
      sql`SELECT ni.relevance_score as score, ni.relevance_reason as reason, s.name as source, ni.title
          FROM news_items ni
          INNER JOIN sources s ON ni.source_id = s.id
          WHERE ni.relevance_score BETWEEN ${min} AND ${max}
          ORDER BY RANDOM()
          LIMIT 4`
    );
    console.log(`\n=== Score ${min}-${max} ===`);
    for (const row of rows as unknown as Array<{ score: number; reason: string; source: string; title: string }>) {
      console.log(`[${row.score}] ${row.source.slice(0, 32)}: ${row.title.slice(0, 80)}`);
      console.log(`     → ${row.reason}`);
    }
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
