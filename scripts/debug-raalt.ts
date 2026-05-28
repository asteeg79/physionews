import { readFileSync } from 'fs';
import * as cheerio from 'cheerio';

const html = readFileSync('tests/adapters/fixtures/raalt.html', 'utf-8');
const $ = cheerio.load(html);

console.log('Body classes:', $('body').attr('class')?.slice(0, 100));
console.log('Has .site-main:', $('.site-main').length, '| .et_pb_post:', $('.et_pb_post').length, '| .et_pb_blog_grid:', $('.et_pb_blog_grid').length);

const candidates = new Set<string>();
$('[class]').each((_, el) => {
  const cls = $(el).attr('class') ?? '';
  cls.split(/\s+/).forEach((c) => {
    if (c.match(/news|post|blog|aktuell|artikel|entry|item/i)) candidates.add(c);
  });
});
console.log('Verdächtige Klassen:', [...candidates].slice(0, 40).join(', '));

console.log('\nLinks mit langen Texten (>20 Zeichen):');
let count = 0;
$('a[href]').each((_, el) => {
  if (count >= 8) return;
  const text = $(el).text().trim();
  const href = $(el).attr('href') ?? '';
  if (
    text.length > 20 &&
    text.length < 200 &&
    !href.startsWith('#') &&
    !text.match(/^(Mehr lesen|Weiterlesen|Read more|Hier|Home|Login|Anmelden)$/i)
  ) {
    console.log(`  parent=${(el.parent as { name?: string })?.name ?? '-'}`);
    console.log(`  href=${href.slice(0, 70)}`);
    console.log(`  text="${text.slice(0, 70)}"`);
    count++;
  }
});
