import { NextRequest } from 'next/server';
import { z } from 'zod';
import { removePushSubscription } from '@/data/push-subscriptions';
import { writeErrorResponse } from '@/lib/write-guard';

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

  try {
    await removePushSubscription(parsed.data.endpoint);
    return Response.json({ ok: true });
  } catch (err) {
    return writeErrorResponse(err);
  }
}
