import { NextRequest } from 'next/server';
import { db, schema } from '@/db';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { detectFeed } from '@/lib/feed-detect';

export async function GET() {
  const allSources = await db
    .select()
    .from(schema.sources)
    .orderBy(asc(schema.sources.category), asc(schema.sources.name));

  return Response.json(allSources);
}

const addSchema = z.object({
  url: z.string().url(),
  name: z.string().min(2).optional(),
  category: z
    .enum(['berufspolitik', 'recht', 'evidenz', 'fortbildung', 'leitlinien', 'allgemein'])
    .default('allgemein'),
  /** Wenn true (Default), wird zunächst auto-detect für RSS versucht; sonst Generic-HTML. */
  autoDetect: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { url, autoDetect } = parsed.data;
  let { name, category } = parsed.data;
  let finalUrl = url;
  let adapterType = 'html:generic';
  let detectedTitle: string | undefined;

  if (autoDetect) {
    const feed = await detectFeed(url);
    if (feed) {
      finalUrl = feed.url;
      adapterType = 'rss';
      detectedTitle = feed.title;
    }
  }

  if (!name) {
    name = detectedTitle ?? new URL(finalUrl).hostname.replace(/^www\./, '');
  }

  // Generic-HTML braucht einen registrierten adapter-Typ — wir nutzen unsere Auto-Generic-Variante
  // (siehe registry.ts: dort registrieren wir mehrere Generic-Typen für bekannte Subtypen)
  if (adapterType === 'html:generic') {
    // Wir ergänzen den Generic-Typ in der Registry, falls noch nicht vorhanden
    // (Phase 5 erweitert die Registry später dynamisch — vorerst loggen und Generic nehmen)
    adapterType = 'html:generic';
  }

  try {
    const [inserted] = await db
      .insert(schema.sources)
      .values({
        name,
        url: finalUrl,
        adapterType,
        category,
        isEnabled: true,
        notificationsEnabled: true,
      })
      .returning();
    return Response.json({ ...inserted, detectedAs: adapterType === 'rss' ? 'rss' : 'html' }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: 'Quelle konnte nicht angelegt werden', detail: message }, { status: 500 });
  }
}
