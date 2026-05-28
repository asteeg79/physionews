import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { z } from 'zod';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  await db
    .insert(schema.pushSubscriptions)
    .values({ endpoint, keys, userAgent })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { keys, lastSeenAt: new Date(), userAgent },
    });

  return Response.json({ ok: true });
}
