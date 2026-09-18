import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as cheerio from 'cheerio';
import type { Source } from '../../src/data/types';
import { makeSource } from '../helpers';

import { IfkAdapter } from '../../src/lib/adapters/html/ifk';
import { BmgAdapter } from '../../src/lib/adapters/html/bmg';
import { RkiAdapter } from '../../src/lib/adapters/html/rki';
import { CochraneAdapter } from '../../src/lib/adapters/html/cochrane';
import { PhysioDeutschlandAdapter } from '../../src/lib/adapters/html/physio-deutschland';
import { VdbNrwAdapter } from '../../src/lib/adapters/html/vdb-nrw';
import { DgspAdapter } from '../../src/lib/adapters/html/dgsp';
import { RaAltAdapter } from '../../src/lib/adapters/html/ra-alt';
import { VptAdapter } from '../../src/lib/adapters/html/vpt';
import { GbaAdapter } from '../../src/lib/adapters/html/gba';

const FIX = join(__dirname, 'fixtures');

function loadAndParse(
  fixture: string,
  baseUrl: string,
  adapter: { parse: (...args: never[]) => Array<{ title: string; url: string; publishedAt: Date }> }
) {
  const html = readFileSync(join(FIX, fixture), 'utf-8');
  const $ = cheerio.load(html);
  const src = makeSource({ id: 'test', name: 'test', url: baseUrl });
  return (adapter.parse as (a: typeof $, b: string, c: Source) => Array<{ title: string; url: string; publishedAt: Date }>)($, baseUrl, src);
}

describe('Quellen-spezifische HTML-Adapter (Fixture-basiert)', () => {
  it('IfkAdapter extrahiert IFK-Aktuelles', () => {
    const items = loadAndParse('ifk.html', 'https://www.ifk.de/verband/aktuelles', new IfkAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items[0].title).toMatch(/physio|IFK|Praxis/i);
    expect(items[0].url).toContain('/artikel/');
  });

  it('BmgAdapter extrahiert BMG-Pressemitteilungen', () => {
    const items = loadAndParse('bmg.html', 'https://www.bundesgesundheitsministerium.de/presse/pressemitteilungen', new BmgAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.every((i) => i.url.includes('/presse/pressemitteilungen/'))).toBe(true);
  });

  it('RkiAdapter extrahiert RKI-Pressemitteilungen', () => {
    const items = loadAndParse('rki.html', 'https://www.rki.de/DE/Aktuelles/Neuigkeiten-und-Presse/Meldungen-PM/meldungen-pressemitteilungen-node.html', new RkiAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items.every((i) => i.url.includes('/Meldungen-PM/'))).toBe(true);
  });

  it('CochraneAdapter extrahiert Cochrane-Drupal-Views mit Daten', () => {
    const items = loadAndParse('cochrane.html', 'https://www.cochrane.de/news', new CochraneAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(10);
    // Sollte echte Daten haben (keine "alle = jetzt")
    const realDates = items.filter((i) => Math.abs(i.publishedAt.getTime() - Date.now()) > 60_000);
    expect(realDates.length).toBeGreaterThan(0);
  });

  it('PhysioDeutschlandAdapter extrahiert News-Bundesweit', () => {
    const items = loadAndParse('physio-deutschland.html', 'https://www.physio-deutschland.de/fachkreise/news-bundesweit.html', new PhysioDeutschlandAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('VdbNrwAdapter extrahiert WordPress-Posts', () => {
    const items = loadAndParse('vdb-nrw.html', 'https://physio.nrw/', new VdbNrwAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(10);
  });

  it('DgspAdapter extrahiert /news/1/{id}/ Pfade', () => {
    const items = loadAndParse('dgsp.html', 'https://www.dgsp.de/news/', new DgspAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((i) => i.url.includes('/nachrichten/'))).toBe(true);
  });

  it('RaAltAdapter extrahiert Jimdo .j-blogarticle', () => {
    const items = loadAndParse('raalt.html', 'https://www.rechtsanwaltalt.de/aktuelles/', new RaAltAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(10);
  });

  it('VptAdapter filtert Sidebar-Seiten und behält /news-ansicht/', () => {
    const items = loadAndParse('vpt.html', 'https://www.vpt.de/', new VptAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(3);
    // Junk-Sidebars dürfen nicht enthalten sein
    expect(items.find((i) => i.title.toLowerCase() === 'teilnahmebedingungen')).toBeUndefined();
    expect(items.find((i) => i.title.toLowerCase() === 'fachkräftemangel')).toBeUndefined();
  });

  it('GbaAdapter behält nur numerische Pressemitteilungs-IDs', () => {
    const items = loadAndParse('gba.html', 'https://www.g-ba.de/presse/pressemitteilungen/', new GbaAdapter() as never);
    expect(items.length).toBeGreaterThanOrEqual(10);
    // Navigations-Titel dürfen nicht erscheinen
    expect(items.find((i) => i.title.toLowerCase().includes('zur nächsten seite'))).toBeUndefined();
    expect(items.every((i) => /\/\d+\/?$/.test(i.url))).toBe(true);
  });
});
