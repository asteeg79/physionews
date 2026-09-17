import { NextRequest } from 'next/server';
import { z } from 'zod';
import { deleteSource, updateSource } from '@/data/sources';
import { writeErrorResponse } from '@/lib/write-guard';

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

  try {
    const updated = await updateSource(id, parsed.data);
    if (!updated) {
      return Response.json({ error: 'Quelle nicht gefunden' }, { status: 404 });
    }
    return Response.json(updated);
  } catch (err) {
    return writeErrorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await deleteSource(id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return writeErrorResponse(err);
  }
}
