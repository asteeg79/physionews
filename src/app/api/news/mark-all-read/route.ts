import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

/**
 * Markiert alle ungelesenen Items als gelesen.
 * Optimistic-UI im Frontend, hier nur Persistierung.
 */
export async function POST() {
  const result = await db
    .update(schema.newsItems)
    .set({ isRead: true })
    .where(eq(schema.newsItems.isRead, false))
    .returning({ id: schema.newsItems.id });

  return Response.json({ ok: true, markedAsRead: result.length });
}
