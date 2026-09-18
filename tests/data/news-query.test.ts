import { describe, it, expect, vi } from 'vitest';

/**
 * Tests für `queryNews` — die Filter- und Sortierlogik, die früher als
 * SQL-Query in /api/news stand (Kategorie, Datum, Top-News, Tags,
 * Evidenz-Overlap, Volltextsuche).
 *
 * Gemockt wird nur der JSON-Store; die Repository-Module darüber laufen
 * echt, damit auch das Mapping der Datumsfelder mitgeprüft wird.
 */

const { files } = vi.hoisted(() => {
  const sources = [
    { id: 'src-a', name: 'IFK Aktuelles', category: 'gesetz', iconName: 'users' },
    { id: 'src-b', name: 'Thieme physioscience', category: 'fachlich', iconName: 'book-open' },
  ].map((s) => ({
    ...s,
    url: `https://example.test/${s.id}`,
    adapterType: 'rss',
    isEnabled: true,
    notificationsEnabled: true,
    lastFetchAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));

  const base = {
    summary: null as string | null,
    imageUrl: null,
    fetchedAt: '2026-05-23T08:00:00.000Z',
    relevanceMethod: 'ai',
    relevanceReason: null,
    isTopNews: false,
    topics: [] as string[],
    lang: 'de',
  };

  const news = [
    {
      ...base,
      id: 'n-top',
      sourceId: 'src-a',
      title: 'Blankoverordnung startet',
      url: 'https://example.test/1',
      publishedAt: '2026-05-20T00:00:00.000Z',
      relevanceScore: 10,
      isTopNews: true,
      topics: ['GKV', 'Heilmittelversorgung'],
    },
    {
      ...base,
      id: 'n-rct',
      sourceId: 'src-b',
      title: 'Manuelle Therapie bei Nackenschmerzen',
      summary: 'Randomisierte kontrollierte Studie über Übungen.',
      url: 'https://example.test/2',
      publishedAt: '2026-05-22T00:00:00.000Z',
      relevanceScore: 9,
      topics: ['RCT', 'Wirbelsäule'],
    },
    {
      ...base,
      id: 'n-old',
      sourceId: 'src-a',
      title: 'Alte Verbandsmeldung',
      url: 'https://example.test/3',
      publishedAt: '2026-01-05T00:00:00.000Z',
      relevanceScore: 7,
    },
    {
      ...base,
      id: 'n-mittel',
      // Bewusst dieselbe Quelle wie n-top und mit gemeinsamem Suchwort:
      // so lässt sich prüfen, dass der Deckel bei gezielter Abfrage ruht.
      sourceId: 'src-a',
      title: 'Blankoverordnung: mittelbare Folgen für die Praxis',
      url: 'https://example.test/7',
      publishedAt: '2026-05-19T00:00:00.000Z',
      // Score 5 liegt über der Lösch-Schwelle (4), aber unter der
      // Anzeige-Voreinstellung (7) — genau der Bereich, den die
      // einstellbare Schwelle sichtbar machen soll.
      relevanceScore: 5,
      topics: ['GKV'],
    },
    {
      ...base,
      id: 'n-low',
      sourceId: 'src-a',
      title: 'Kaum relevant',
      url: 'https://example.test/4',
      publishedAt: '2026-05-21T00:00:00.000Z',
      relevanceScore: 2,
    },
    {
      ...base,
      id: 'n-en',
      sourceId: 'src-b',
      title: 'English study on manual therapy',
      url: 'https://example.test/5',
      publishedAt: '2026-05-21T00:00:00.000Z',
      relevanceScore: 9,
      lang: 'en',
    },
    {
      ...base,
      id: 'n-orphan',
      sourceId: 'src-geloescht',
      title: 'Quelle wurde entfernt',
      url: 'https://example.test/6',
      publishedAt: '2026-05-21T00:00:00.000Z',
      relevanceScore: 9,
    },
  ];

  return { files: { 'sources.json': sources, 'news.json': news } as Record<string, unknown> };
});

vi.mock('@/data/json-store', () => ({
  readJson: async <T,>(fileName: string, fallback: T) =>
    (files[fileName] as T | undefined) ?? fallback,
  writeJson: async () => undefined,
  clearCache: () => undefined,
  toDate: (v: string | null | undefined) => (v ? new Date(v) : null),
  toRequiredDate: (v: string | null | undefined) => (v ? new Date(v) : new Date(0)),
}));

const { queryNews } = await import('../../src/data/news');

const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);

describe('queryNews — Grundfilter', () => {
  it('blendet Items unter dem Relevanz-Schwellwert aus', async () => {
    expect(ids(await queryNews())).not.toContain('n-low');
  });

  it('blendet nicht-deutsche Items aus', async () => {
    expect(ids(await queryNews())).not.toContain('n-en');
  });

  it('blendet Items ohne existierende Quelle aus', async () => {
    expect(ids(await queryNews())).not.toContain('n-orphan');
  });

  it('sortiert nach Relevanz, dann nach Datum — beides absteigend', async () => {
    expect(ids(await queryNews())).toEqual(['n-top', 'n-rct', 'n-old']);
  });

  it('reicht die Quelle mit aus', async () => {
    const [first] = await queryNews();
    expect(first.source).toEqual({
      id: 'src-a',
      name: 'IFK Aktuelles',
      category: 'gesetz',
      iconName: 'users',
    });
  });

  it('wandelt die Datumsfelder in Date-Objekte um', async () => {
    const [first] = await queryNews();
    expect(first.publishedAt).toBeInstanceOf(Date);
    expect(first.publishedAt.toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });
});

describe('queryNews — Filter', () => {
  it('filtert nach der Kategorie der Quelle', async () => {
    expect(ids(await queryNews({ category: 'fachlich' }))).toEqual(['n-rct']);
  });

  it('filtert nach Datum', async () => {
    const since = new Date('2026-05-01T00:00:00.000Z');
    expect(ids(await queryNews({ since }))).toEqual(['n-top', 'n-rct']);
  });

  it('filtert auf Top-News', async () => {
    expect(ids(await queryNews({ topNewsOnly: true }))).toEqual(['n-top']);
  });

  it('filtert nach Themen-Tag', async () => {
    expect(ids(await queryNews({ tag: 'RCT' }))).toEqual(['n-rct']);
  });

  it('filtert auf Items mit mindestens einem Evidenz-Tag', async () => {
    expect(ids(await queryNews({ evidenceTopics: ['RCT', 'S3-Leitlinie'] }))).toEqual(['n-rct']);
  });

  it('begrenzt die Anzahl', async () => {
    expect(await queryNews({ limit: 2 })).toHaveLength(2);
  });
});

describe('queryNews — Suche', () => {
  it('findet über den Titel, unabhängig von Groß-/Kleinschreibung', async () => {
    expect(ids(await queryNews({ search: 'blankoverordnung' }))).toEqual(['n-top']);
  });

  it('findet auch über die Zusammenfassung', async () => {
    expect(ids(await queryNews({ search: 'randomisierte' }))).toEqual(['n-rct']);
  });

  it('ignoriert Umlaute und Akzente', async () => {
    expect(ids(await queryNews({ search: 'ubungen' }))).toEqual(['n-rct']);
  });

  it('verknüpft mehrere Begriffe mit UND', async () => {
    expect(ids(await queryNews({ search: 'manuelle nackenschmerzen' }))).toEqual(['n-rct']);
    expect(await queryNews({ search: 'manuelle blankoverordnung' })).toHaveLength(0);
  });

  it('behandelt Anführungszeichen als zusammenhängende Wortfolge', async () => {
    expect(ids(await queryNews({ search: '"manuelle therapie"' }))).toEqual(['n-rct']);
    expect(await queryNews({ search: '"therapie manuelle"' })).toHaveLength(0);
  });

  it('schließt Begriffe mit führendem Minus aus', async () => {
    expect(ids(await queryNews({ search: '-manuelle' }))).toEqual(['n-top', 'n-old']);
  });
});

describe('queryNews — Deckel pro Quelle', () => {
  it('behält je Quelle die relevantesten Items', async () => {
    // src-a liefert n-top (10) und n-old (7) — bei max 1 gewinnt n-top
    expect(ids(await queryNews({ maxPerSource: 1 }))).toEqual(['n-top', 'n-rct']);
  });

  it('greift vor der Mengenbegrenzung', async () => {
    // Ohne Deckel wären es 3 Items; der Deckel reduziert auf 2, das
    // anschließende limit kann daran nichts mehr ändern.
    expect(await queryNews({ maxPerSource: 1, limit: 3 })).toHaveLength(2);
  });

  it('gilt nicht bei gezielter Suche', async () => {
    // n-top und n-mittel stammen beide aus src-a und teilen das Suchwort.
    // Mit Deckel 1 käme nur eines durch — bei einer Suche sollen beide
    // erscheinen.
    const result = await queryNews({
      maxPerSource: 1,
      minRelevance: 4,
      search: 'blankoverordnung',
    });
    expect(ids(result)).toEqual(['n-top', 'n-mittel']);
  });

  it('gilt nicht bei Tag-Filter', async () => {
    const result = await queryNews({ maxPerSource: 1, minRelevance: 4, tag: 'GKV' });
    expect(ids(result)).toEqual(['n-top', 'n-mittel']);
  });
});

describe('queryNews — einstellbare Mindest-Relevanz', () => {
  it('blendet mittelbar relevante Items in der Voreinstellung aus', async () => {
    // n-mittel hat Score 5, die Voreinstellung ist 7
    expect(ids(await queryNews())).not.toContain('n-mittel');
  });

  it('macht sie bei lockerer Einstellung sichtbar', async () => {
    expect(ids(await queryNews({ minRelevance: 4 }))).toContain('n-mittel');
  });

  it('holt aber nichts unterhalb der Lösch-Schwelle hervor', async () => {
    // n-low hat Score 2 — solche Items existieren im Betrieb gar nicht
    expect(ids(await queryNews({ minRelevance: 4 }))).not.toContain('n-low');
  });

  it('lässt sich strenger stellen', async () => {
    // n-old hat Score 7 und fällt bei 8 heraus
    expect(ids(await queryNews({ minRelevance: 8 }))).toEqual(['n-top', 'n-rct']);
  });
});
