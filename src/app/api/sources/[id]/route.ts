import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const patchSchema = z.object({
  isEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  name: z.string().min(2).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [updated] = await db
    .update(schema.sources)
    .set(parsed.data)
    .where(eq(schema.sources.id, id))
    .returning();

  if (!updated) {
    return Response.json({ error: 'Quelle nicht gefunden' }, { status: 404 });
  }

  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.delete(schema.sources).where(eq(schema.sources.id, id));
  return new Response(null, { status: 204 });
}
