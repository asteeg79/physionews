import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';

const FIX = join(process.cwd(), 'tests/adapters/fixtures');

// Häufige Selektoren für News-Listen
const candidateSelectors = [
  'article',
  '.news-item',
  '.news',
  '.post',
  '.entry',
  '.teaser',
  '.list-item',
  '[class*="news-list"] > li',
  '[class*="article-list"] > li',
  '.c-news-list__item',
  '.news-block',
  '.press-release',
  '.pressemitteilung',
];

function inspectFile(name: string) {
  const html = readFileSync(join(FIX, name), 'utf-8');
  const $ = cheerio.load(html);

  console.log(`\n=== ${name} (${html.length} bytes) ===`);

  // JSON-LD prüfen
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  let jsonLdArticles = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const obj = JSON.parse($(el).text());
      const types = JSON.stringify(obj).match(/"@type":"[^"]+"/g) ?? [];
      jsonLdArticles += types.filter((t) => /Article|Posting/.test(t)).length;
    } catch {}
  });
  console.log(`  JSON-LD scripts: ${jsonLdCount}, davon Artikel-Typen: ${jsonLdArticles}`);

  // Selektoren testen
  for (const sel of candidateSelectors) {
    const n = $(sel).length;
    if (n >= 2 && n <= 100) {
      // Beispiel-Titel aus dem ersten Match
      const first = $(sel).first();
      const title = (first.find('h1, h2, h3, h4').first().text() ||
        first.find('a').first().text() ||
        '').trim().replace(/\s+/g, ' ').slice(0, 70);
      const href = first.find('a[href]').first().attr('href');
      console.log(`  ${sel.padEnd(30)} → ${n} matches | "${title}" | ${href?.slice(0, 60) ?? '-'}`);
    }
  }
}

const files = ['ifk.html', 'bmg.html', 'rki.html', 'awmf.html', 'vpt.html', 'vpt-nrw.html', 'cochrane.html', 'dgsp.html', 'physio-deutschland.html', 'vdb-nrw.html', 'dvmt.html', 'raalt.html', 'gba.html'];
for (const f of files) {
  try {
    inspectFile(f);
  } catch (err) {
    console.log(`\n=== ${f}: Fehler — ${(err as Error).message}`);
  }
}
