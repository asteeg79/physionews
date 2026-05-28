import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export async function GET() {
  const [settings] = await db.select().from(schema.appSettings).limit(1);
  if (!settings) {
    return Response.json({ error: 'Settings nicht gefunden' }, { status: 404 });
  }
  return Response.json(settings);
}

const patchSchema = z
  .object({
    refreshIntervalHours: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
    refreshWindowStart: z.number().int().min(0).max(23).optional(),
    refreshWindowEnd: z.number().int().min(1).max(24).optional(),
    retentionDays: z.number().int().min(7).max(365).optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.refreshWindowStart === undefined ||
      data.refreshWindowEnd === undefined ||
      data.refreshWindowStart < data.refreshWindowEnd,
    {
      message: 'refreshWindowStart muss kleiner als refreshWindowEnd sein',
      path: ['refreshWindowStart'],
    }
  );

export async function PATCH(req: NextRequest) {
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

  if (Object.keys(parsed.data).length === 0) {
    return Response.json({ error: 'Keine Änderungen' }, { status: 400 });
  }

  const [updated] = await db
    .update(schema.appSettings)
    .set(parsed.data)
    .where(eq(schema.appSettings.id, 1))
    .returning();

  return Response.json(updated);
}
