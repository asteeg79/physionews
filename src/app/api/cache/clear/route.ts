import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

/**
 * Löscht alle gespeicherten News-Items.
 * `lastGlobalRefreshAt` wird auf null gesetzt, damit der nächste App-Open
 * sofort einen frischen Refresh auslöst.
 */
export async function POST() {
  const deleted = await db
    .delete(schema.newsItems)
    .returning({ id: schema.newsItems.id });

  await db
    .update(schema.appSettings)
    .set({ lastGlobalRefreshAt: null })
    .where(eq(schema.appSettings.id, 1));

  return Response.json({ ok: true, deleted: deleted.length });
}
