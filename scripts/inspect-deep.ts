import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';

const FIX = join(process.cwd(), 'tests/adapters/fixtures');

function inspect(name: string, opts: { showRaw?: boolean } = {}) {
  const html = readFileSync(join(FIX, name), 'utf-8');
  const $ = cheerio.load(html);

  console.log(`\n========== ${name} (${(html.length / 1024).toFixed(1)} KB) ==========`);

  // Suche nach href-Patterns mit Datums-ähnlichen URLs oder "news"/"presse"/"artikel"
  const links = $('a[href]')
    .toArray()
    .map((el) => ({
      href: $(el).attr('href') ?? '',
      text: $(el).text().trim().replace(/\s+/g, ' '),
      parent: el.parent && el.parent.type === 'tag' ? `${(el.parent as { name: string }).name}.${$(el.parent as cheerio.AnyNode).attr('class') ?? ''}` : '',
    }))
    .filter(
      (l) =>
        l.text.length > 15 &&
        l.text.length < 200 &&
        (l.href.includes('news') ||
          l.href.includes('presse') ||
          l.href.includes('artikel') ||
          l.href.includes('aktuell') ||
          l.href.includes('leitlinien') ||
          l.href.match(/\/20\d{2}\//) || // Datum in URL
          l.href.match(/-\d{4,}/))
    )
    .slice(0, 8);

  console.log(`Kandidaten-Links (text > 15 Zeichen, news/presse/datum):`);
  for (const l of links) {
    console.log(`  parent=${l.parent.slice(0, 40)}`);
    console.log(`    href=${l.href.slice(0, 80)}`);
    console.log(`    text="${l.text.slice(0, 80)}"`);
  }
  if (links.length === 0) console.log('  (keine gefunden)');

  // Klassen im Body, die "news"/"item"/"teaser" enthalten
  if (opts.showRaw) {
    const classes = new Set<string>();
    $('[class]').each((_, el) => {
      const cls = $(el).attr('class') ?? '';
      cls.split(/\s+/).forEach((c) => {
        if (c.match(/news|item|teaser|article|post|entry|press|meldung/i)) classes.add(c);
      });
    });
    console.log(`Verdächtige Klassen: ${[...classes].slice(0, 20).join(', ')}`);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  ['rki.html', 'bmg.html', 'awmf.html', 'vpt-nrw.html', 'cochrane.html', 'dgsp.html', 'physio-deutschland.html', 'dvmt.html', 'raalt.html', 'gba.html'].forEach((n) => inspect(n, { showRaw: true }));
} else {
  args.forEach((n) => inspect(n, { showRaw: true }));
}
