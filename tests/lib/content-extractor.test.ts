import { describe, it, expect, vi, afterEach } from 'vitest';
import { extractArticleSummary } from '../../src/lib/content-extractor';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(html: string, contentType = 'text/html', status = 200) {
  global.fetch = vi.fn(
    async () =>
      new Response(html, {
        status,
        headers: { 'content-type': contentType },
      })
  ) as unknown as typeof fetch;
}

describe('extractArticleSummary', () => {
  it('extrahiert <p>-Sequenz aus <article>', async () => {
    mockFetch(`<html><body>
      <nav>Navigation Junk</nav>
      <article>
        <h1>Headline</h1>
        <p>Dies ist der erste echte Absatz mit ausreichend Inhalt für eine vollständige Vorschau-Anzeige der News-Karte mit über achtzig Zeichen.</p>
        <p>Ein zweiter Absatz mit weiterem Kontext zum Thema des Artikels und zusätzlichen Hintergrund-Details für den Leser dieser Vorschau.</p>
      </article>
    </body></html>`);

    const result = await extractArticleSummary('https://example.com/article');
    expect(result).not.toBeNull();
    expect(result).toContain('erste echte Absatz');
    expect(result).toContain('zweiter Absatz');
    expect(result).not.toContain('Navigation Junk');
  });

  it('liest JSON-LD articleBody bei fehlendem article-tag', async () => {
    mockFetch(`<html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"NewsArticle",
        "headline":"Test",
        "articleBody":"Dies ist ein langer Artikel-Body aus JSON-LD mit genug Text zur Vorschau-Extraktion. Inhalt geht hier weiter mit mehr Details zum Thema."
      }</script>
    </head><body><div>Nur Navigation</div></body></html>`);

    const result = await extractArticleSummary('https://example.com/article');
    expect(result).toContain('JSON-LD');
  });

  it('fällt auf og:description zurück, wenn nichts anderes da ist', async () => {
    const desc =
      'Dies ist eine sehr ausführliche og:description mit über 100 Zeichen Inhalt zur Vorschau-Anzeige.';
    mockFetch(`<html><head>
      <meta property="og:description" content="${desc}">
    </head><body><nav>nav</nav></body></html>`);

    const result = await extractArticleSummary('https://example.com/article');
    expect(result).toContain('og:description');
  });

  it('liefert null bei HTTP 5xx', async () => {
    mockFetch('Server Error', 'text/plain', 503);
    const result = await extractArticleSummary('https://example.com/error');
    expect(result).toBeNull();
  });

  it('skipt Google News URLs sofort', async () => {
    // fetch sollte gar nicht aufgerufen werden
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await extractArticleSummary(
      'https://news.google.com/rss/articles/CBMifEFV...'
    );
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('kürzt sauber an Satzgrenzen', async () => {
    const longText = 'Erster Satz mit ausreichend Inhalt. ' + 'X '.repeat(500);
    mockFetch(`<html><body><article><p>${longText}</p></article></body></html>`);

    const result = await extractArticleSummary('https://example.com');
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(800);
  });

  it('filtert <nav>, <footer>, <aside> aus dem Body-Fallback', async () => {
    mockFetch(`<html><body>
      <nav><p>Nav-Junk-Text mit über vierzig Zeichen Länge damit er nicht im Filter rausfällt.</p></nav>
      <footer><p>Footer-Junk mit über vierzig Zeichen damit er nicht im Filter rausfällt.</p></footer>
      <p>Echter Body-Text mit ausreichend Inhalt für die Vorschau-Extraktion ohne jegliche Container-Tags rundherum.</p>
      <p>Noch ein zweiter Absatz mit weiterem Inhalt der zur Vorschau-Extraktion mit beiträgt und ausreichend lang ist.</p>
    </body></html>`);

    const result = await extractArticleSummary('https://example.com');
    expect(result).toContain('Echter Body-Text');
    expect(result).not.toContain('Nav-Junk');
    expect(result).not.toContain('Footer-Junk');
  });
});
