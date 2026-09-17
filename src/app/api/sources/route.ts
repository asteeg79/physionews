import { NextRequest } from 'next/server';
import { z } from 'zod';
import { addSource, listSources } from '@/data/sources';
import type { NewsCategory } from '@/data/types';
import { detectFeed } from '@/lib/feed-detect';
import { ALL_CATEGORIES } from '@/lib/categories';
import { writeErrorResponse } from '@/lib/write-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await listSources());
}

const addSchema = z.object({
  url: z.string().url(),
  name: z.string().min(2).optional(),
  category: z.enum(ALL_CATEGORIES as readonly [NewsCategory, ...NewsCategory[]]).default('fachlich'),
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

  const { url, autoDetect, category } = parsed.data;
  let { name } = parsed.data;
  let finalUrl = url;
  // Ohne erkannten Feed landet die Quelle beim Generic-HTML-Adapter,
  // der in der Registry unter genau diesem Namen registriert ist.
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

  try {
    const created = await addSource({ name, url: finalUrl, adapterType, category });
    return Response.json(
      { ...created, detectedAs: adapterType === 'rss' ? 'rss' : 'html' },
      { status: 201 }
    );
  } catch (err) {
    return writeErrorResponse(err);
  }
}
