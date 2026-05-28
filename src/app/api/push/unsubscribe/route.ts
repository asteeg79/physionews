import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const bodySchema = z.object({ endpoint: z.string().url() });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await db
    .delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, parsed.data.endpoint));

  return Response.json({ ok: true });
}
