import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { asc } from 'drizzle-orm';
import { z } from 'zod';

const addSourceSchema = z.object({
  name: z.string().min(2),
  url: z.string().url(),
  adapterType: z.string().default('rss'),
  category: z.enum(['berufspolitik', 'recht', 'evidenz', 'fortbildung', 'leitlinien', 'allgemein']),
});

export async function GET() {
  const allSources = await db
    .select()
    .from(schema.sources)
    .orderBy(asc(schema.sources.category), asc(schema.sources.name));

  return Response.json(allSources);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const parsed = addSourceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [inserted] = await db
    .insert(schema.sources)
    .values(parsed.data)
    .returning();

  return Response.json(inserted, { status: 201 });
}
