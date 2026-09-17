import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSettings, updateSettings } from '@/data/settings';
import { writeErrorResponse } from '@/lib/write-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getSettings());
}

const patchSchema = z
  .object({
    refreshIntervalHours: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
    refreshWindowStart: z.number().int().min(0).max(23).optional(),
    refreshWindowEnd: z.number().int().min(1).max(24).optional(),
    retentionDays: z.number().int().min(7).max(90).optional(),
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

  try {
    return Response.json(await updateSettings(parsed.data));
  } catch (err) {
    return writeErrorResponse(err);
  }
}
