import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1, prepare: false });

async function main() {
  const sourceCount = await sql`SELECT COUNT(*)::int as n FROM sources`;
  const sourcesByCategory = await sql`SELECT category, COUNT(*)::int as n FROM sources GROUP BY category ORDER BY category`;
  const settings = await sql`SELECT * FROM app_settings`;
  const subscriptionCount = await sql`SELECT COUNT(*)::int as n FROM push_subscriptions`;

  console.log(`Quellen gesamt: ${sourceCount[0].n}`);
  console.log('Nach Kategorie:');
  for (const row of sourcesByCategory) {
    console.log(`  ${row.category}: ${row.n}`);
  }
  console.log(`Push-Subscriptions: ${subscriptionCount[0].n}`);
  console.log('App-Einstellungen:', settings[0]);
  await sql.end();
}

main();
