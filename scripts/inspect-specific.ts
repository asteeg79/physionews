import { readFileSync } from 'fs';
import * as cheerio from 'cheerio';

function show(name: string, selector: string) {
  const html = readFileSync(`tests/adapters/fixtures/${name}`, 'utf-8');
  const $ = cheerio.load(html);
  const elements = $(selector);
  if (elements.length === 0) return;
  console.log(`\n${name} | ${selector} → ${elements.length} matches`);
  elements.slice(0, 3).each((_, el) => {
    const titleEl = $(el).find('h1, h2, h3, h4, a').first();
    const title = titleEl.text().trim().replace(/\s+/g, ' ').slice(0, 80);
    const href = $(el).find('a[href]').first().attr('href');
    const timeEl = $(el).find('time, [class*="date"], [class*="datum"]').first();
    const dateText = (timeEl.attr('datetime') ?? timeEl.text().trim()).slice(0, 40);
    console.log(`  href="${href?.slice(0, 60) ?? '-'}" date="${dateText}"`);
    console.log(`  title="${title}"`);
  });
}

const probes: Array<[string, string]> = [
  ['rki.html', '.c-teaser'],
  ['rki.html', '.c-news-list__item'],
  ['rki.html', 'main article'],
  ['rki.html', 'main li a[href*="Pressemitteilung"]'],
  ['rki.html', 'a[href*="/Aktuelles/"]'],
  ['cochrane.html', '.views-row'],
  ['cochrane.html', '.view-news .views-row'],
  ['cochrane.html', 'article'],
  ['vpt.html', '.news-teaser'],
  ['vpt.html', '.c-news-item'],
  ['vpt.html', 'a[href*="/aktuelles/"]'],
  ['vpt-nrw.html', '.news-list-view'],
  ['vpt-nrw.html', '.aktuelles-item'],
  ['vpt-nrw.html', '[class*="news"]'],
  ['dgsp.html', '#newsList li'],
  ['dgsp.html', 'a[href^="/news/1/"]'],
  ['gba.html', '.c-content-list__item'],
  ['gba.html', '.c-news-list__item'],
  ['gba.html', 'article'],
  ['gba.html', 'a[href*="pressemitteilung"]'],
  ['raalt.html', 'article.post'],
  ['raalt.html', 'article'],
  ['raalt.html', '.entry-title'],
];
for (const [n, s] of probes) show(n, s);
