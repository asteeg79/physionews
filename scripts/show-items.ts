import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import type { Source } from '../src/db/schema';

import { VptAdapter, VptNrwAdapter } from '../src/lib/adapters/html/vpt';
import { GbaAdapter } from '../src/lib/adapters/html/gba';
import { DgspAdapter } from '../src/lib/adapters/html/dgsp';

const FIX = join(process.cwd(), 'tests/adapters/fixtures');

function makeSource(url: string): Source {
  return { id: 'test', name: 'test', url, adapterType: 'test', category: 'evidenz', iconName: null, isEnabled: true, notificationsEnabled: true, lastFetchAt: null, lastSuccessAt: null, lastError: null, createdAt: new Date() };
}

function show(adapter: { parse: (...args: unknown[]) => unknown[] }, name: string, fixture: string, baseUrl: string) {
  const html = readFileSync(join(FIX, fixture), 'utf-8');
  const $ = cheerio.load(html);
  const items = (adapter.parse as (a: typeof $, b: string, c: Source) => Array<{ title: string; url: string }>)($, baseUrl, makeSource(baseUrl));
  console.log(`\n=== ${name} (${items.length} items) ===`);
  items.slice(0, 12).forEach((i, idx) => console.log(`  ${idx + 1}. ${i.title.slice(0, 70)}\n     ${i.url.slice(0, 90)}`));
}

show(new VptAdapter() as never, 'VPT', 'vpt.html', 'https://www.vpt.de/');
show(new GbaAdapter() as never, 'G-BA', 'gba.html', 'https://www.g-ba.de/presse/pressemitteilungen/');
show(new DgspAdapter() as never, 'DGSP', 'dgsp.html', 'https://www.dgsp.de/news/');
