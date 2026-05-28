import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Verhindert mehrere Verbindungen im Dev-Modus (Next.js Hot Reload)
const globalForDb = globalThis as unknown as { _db: DrizzleDb | undefined };

function createDb(): DrizzleDb {
  const client = postgres(connectionString, {
    max: 1,
    ssl: 'require',
    prepare: false, // Supavisor-Pooler unterstützt keine prepared statements
  });
  return drizzle(client, { schema });
}

export const db: DrizzleDb = globalForDb._db ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb._db = db;
}

export { schema };
