import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

/**
 * POST /api/news/[id]/read — markiert ein Item als gelesen.
 * Wird beim Klick auf eine NewsCard aufgerufen.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const [updated] = await db
    .update(schema.newsItems)
    .set({ isRead: true })
    .where(eq(schema.newsItems.id, id))
    .returning({ id: schema.newsItems.id });

  if (!updated) {
    return Response.json({ error: 'Item nicht gefunden' }, { status: 404 });
  }

  return Response.json({ ok: true });
}
