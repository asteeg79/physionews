import { readFileSync } from 'fs';
import * as cheerio from 'cheerio';
const html = readFileSync('tests/adapters/fixtures/raalt.html', 'utf-8');
const $ = cheerio.load(html);

for (const sel of ['.j-blogarticle', '.j-blog-header', '.j-blog-headline a', '.j-blogarticle a[href]', 'div.j-blogarticle', '[class*="blogarticle"]', '[class*="blog-headline"]']) {
  const n = $(sel).length;
  console.log(`${sel.padEnd(35)} → ${n}`);
  if (n > 0 && n < 30) {
    $(sel).slice(0, 2).each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, ' ').slice(0, 70);
      const href = $(el).is('a') ? $(el).attr('href') : $(el).find('a').first().attr('href');
      console.log(`     href=${href?.slice(0, 60)} | "${t.slice(0, 60)}"`);
    });
  }
}
