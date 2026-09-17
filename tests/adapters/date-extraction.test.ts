import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { GbaAdapter } from '../../src/lib/adapters/html/gba';

/**
 * Tests für die Datumserkennung der HTML-Adapter.
 *
 * Anlass: 70 % aller Items hatten kein echtes Veröffentlichungsdatum und
 * fielen auf den Abrufzeitpunkt zurück. Das betraf nicht nur die Anzeige,
 * sondern auch Zeit-Gruppierung, Retention und die Aktualitätsbewertung
 * der Top-News.
 *
 * Geprüft wird über einen echten Adapter, damit der komplette Weg vom
 * Markup bis zum Item abgedeckt ist.
 */
const adapter = new GbaAdapter();

/** Baut eine Seite mit einer Pressemitteilung und liefert das geparste Item. */
function parseOne(inner: string) {
  const html = `<html><body>${inner}</body></html>`;
  const items = adapter.parse(cheerio.load(html), 'https://www.g-ba.de/');
  return items[0];
}

const LINK = '<a href="/presse/pressemitteilungen/1234/">Beschluss zur Heilmittelversorgung gefasst</a>';

describe('Datumserkennung', () => {
  it('liest das datetime-Attribut', () => {
    const item = parseOne(`<article><time datetime="2026-05-14">egal</time>${LINK}</article>`);
    expect(item.publishedAt.toISOString().slice(0, 10)).toBe('2026-05-14');
  });

  it('liest ein deutsches Datum aus dem Fließtext des Umfelds', () => {
    // Der häufigste Fall in der Praxis: kein <time>, keine Klasse, nur Text.
    const item = parseOne(`<article>${LINK}<p>Erschienen am 28.05.2026</p></article>`);
    expect(item.publishedAt.toISOString().slice(0, 10)).toBe('2026-05-28');
  });

  it('liest ein ausgeschriebenes deutsches Datum', () => {
    const item = parseOne(`<article>${LINK}<span>22. Mai 2026</span></article>`);
    expect(item.publishedAt.toISOString().slice(0, 10)).toBe('2026-05-22');
  });

  it('deutet DD/MM/YYYY deutsch, nicht amerikanisch', () => {
    // JavaScript läse "05/06/2026" als 6. Mai — gemeint ist der 5. Juni.
    const item = parseOne(`<article><time datetime="05/06/2026">x</time>${LINK}</article>`);
    expect(item.publishedAt.toISOString().slice(0, 10)).toBe('2026-06-05');
  });

  it('erkennt den Tag auch bei eindeutigem DD/MM über 12', () => {
    const item = parseOne(`<article><time datetime="27/05/2026">x</time>${LINK}</article>`);
    expect(item.publishedAt.toISOString().slice(0, 10)).toBe('2026-05-27');
  });

  it('sucht über mehrere Ebenen nach oben', () => {
    const item = parseOne(
      `<section><p>12.03.2026</p><div><div><span>${LINK}</span></div></div></section>`
    );
    expect(item.publishedAt.toISOString().slice(0, 10)).toBe('2026-03-12');
  });

  it('verwirft Datumsangaben in der Zukunft', () => {
    const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const dd = String(future.getUTCDate()).padStart(2, '0');
    const mm = String(future.getUTCMonth() + 1).padStart(2, '0');
    const item = parseOne(`<article>${LINK}<p>${dd}.${mm}.${future.getUTCFullYear()}</p></article>`);
    // Fällt auf den Abrufzeitpunkt zurück statt ein Datum in der Zukunft zu setzen
    expect(item.publishedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(item.publishedAt.getTime()).toBeLessThan(Date.now() + 60_000);
  });

  it('verwirft absurd alte Datumsangaben', () => {
    const item = parseOne(`<article>${LINK}<p>01.01.1970</p></article>`);
    expect(item.publishedAt.getUTCFullYear()).toBe(new Date().getUTCFullYear());
  });

  it('greift nicht auf ein Datum weit entfernt im Text zu', () => {
    // Über 600 Zeichen Abstand — das Datum gehört dann vermutlich zu einem
    // anderen Beitrag und wird bewusst ignoriert.
    const filler = 'Lorem ipsum dolor sit amet. '.repeat(30);
    const item = parseOne(`<section><p>12.03.2020</p><p>${filler}</p><article>${LINK}</article></section>`);
    expect(item.publishedAt.getUTCFullYear()).toBe(new Date().getUTCFullYear());
  });
});
