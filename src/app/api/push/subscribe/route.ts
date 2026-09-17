import { NextRequest } from 'next/server';
import { z } from 'zod';
import { upsertPushSubscription } from '@/data/push-subscriptions';
import { writeErrorResponse } from '@/lib/write-guard';

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

  try {
    await upsertPushSubscription({
      endpoint: parsed.data.endpoint,
      keys: parsed.data.keys,
      userAgent: req.headers.get('user-agent'),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return writeErrorResponse(err);
  }
}
