import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';

const FIX = join(process.cwd(), 'tests/adapters/fixtures');

function debug(name: string, selectors: string[]) {
  const html = readFileSync(join(FIX, name), 'utf-8');
  const $ = cheerio.load(html);
  console.log(`\n=== ${name} ===`);
  console.log(`Total bytes: ${html.length}`);
  console.log(`Has <main>: ${$('main').length}, Has #content: ${$('#content').length}, Has #main: ${$('#main').length}`);
  for (const sel of selectors) {
    const n = $(sel).length;
    if (n > 0) {
      const first = $(sel).first();
      const inner = first.text().trim().replace(/\s+/g, ' ').slice(0, 80);
      const href = first.is('a') ? first.attr('href') : first.find('a[href]').first().attr('href');
      console.log(`  ${sel.padEnd(50)} ${n} | href=${href?.slice(0, 50)} | "${inner.slice(0, 50)}"`);
    } else {
      console.log(`  ${sel.padEnd(50)} 0`);
    }
  }
}

debug('rki.html', [
  '.c-teaser',
  '.c-news-list__item',
  'a[href*="/Meldungen-PM/"]',
  'a[href*="/Aktuelles/"]',
  '.c-article-list__item',
  '[class*="teaser"]',
  '.l-article-wrapper a[href*=".html"]',
]);

debug('vdb-nrw.html', [
  'article.post',
  'article',
  '.post',
  '[id^="post-"]',
  '.elementor-post',
  'a[href]',
  '.entry-title',
]);

debug('raalt.html', [
  'article.post',
  'article',
  '[id^="post-"]',
  '.elementor-posts-container > article',
  '.elementor-post',
  'a.elementor-post__thumbnail__link',
  '.entry-title',
]);

debug('gba.html', [
  '.c-press-release-list .c-press-release',
  '.press-release',
  '.c-news-list__item',
  '[class*="press-release"]',
  'article',
  'a[href*="/presse/pressemitteilungen/"]',
]);

debug('vpt-nrw.html', [
  '.news-item',
  '.aktuelles-item',
  'article',
  '.card',
  '.list-group-item',
  '[class*="news"]',
]);

debug('dvmt.html', [
  'article',
  '.news-item',
  '.elementor-post',
  '.elementor-posts-container article',
  'a[href*="/news"]',
]);
