import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests für die Zusage „jede Meldung wird höchstens einmal gepusht".
 *
 * Anlass: Die Zusage hing an einem Feld am Item (`notifiedAt`) und damit an
 * dessen Lebensdauer. Retention und Quellen-Deckel löschen Items laufend;
 * steht ein gelöschtes Item auf der Quellseite weiter, liest der nächste
 * Lauf es mit derselben ID erneut ein — ohne Markierung. Das ergab einen
 * Push alle zwei Stunden für dieselbe Meldung.
 */

const { state } = vi.hoisted(() => ({
  state: {
    news: [] as Array<Record<string, unknown>>,
    notified: new Set<string>(),
    subscriptions: [] as Array<Record<string, unknown>>,
    sent: [] as string[],
  },
}));

vi.mock('@/data/news', () => ({
  loadNews: async () => state.news,
}));

vi.mock('@/data/sources', () => ({
  listSources: async () => [
    { id: 'src-a', name: 'Quelle A', notificationsEnabled: true },
    { id: 'src-yt', name: 'RA Benjamin Alt — YouTube', notificationsEnabled: true },
  ],
}));

vi.mock('@/data/notified', () => ({
  loadNotifiedIds: async () => new Set(state.notified),
  markNotified: async (ids: string[]) => {
    for (const id of ids) state.notified.add(id);
  },
}));

vi.mock('@/data/push-subscriptions', () => ({
  listPushSubscriptions: async () => state.subscriptions,
  removePushSubscriptions: async () => undefined,
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: () => undefined,
    sendNotification: async (_sub: unknown, payload: string) => {
      state.sent.push(JSON.parse(payload).body as string);
    },
  },
}));

const { notifyNewHighRelevanceItems } = await import('../../src/lib/push-sender');

function item(id: string, title: string, score = 9) {
  return {
    id,
    sourceId: 'src-a',
    title,
    url: `https://example.test/${id}`,
    publishedAt: new Date('2026-05-20'),
    relevanceScore: score,
  };
}

/** Beitrag einer gesetzten Quelle — `ageDays` steuert die Pin-Frist. */
function video(id: string, title: string, ageDays: number) {
  return {
    id,
    sourceId: 'src-yt',
    title,
    url: `https://example.test/${id}`,
    publishedAt: new Date(Date.now() - ageDays * 86_400_000),
    // Die Bewertung, die RA Alts Videos tatsächlich bekommen
    relevanceScore: 4,
  };
}

const OPTS = { threshold: 9, notificationsEnabled: true };

beforeEach(() => {
  state.news = [];
  state.notified = new Set();
  state.subscriptions = [{ endpoint: 'https://push.test/a', keys: { p256dh: 'x', auth: 'y' } }];
  state.sent = [];
  process.env.VAPID_SUBJECT = 'mailto:test@example.test';
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
});

describe('notifyNewHighRelevanceItems', () => {
  it('sendet für ein neues hochrelevantes Item', async () => {
    state.news = [item('a1', 'Blankoverordnung kommt')];
    const result = await notifyNewHighRelevanceItems(OPTS);
    expect(result.pushSent).toBe(1);
    expect(state.sent).toEqual(['Blankoverordnung kommt']);
  });

  it('sendet dasselbe Item im nächsten Lauf nicht erneut', async () => {
    state.news = [item('a1', 'Blankoverordnung kommt')];
    await notifyNewHighRelevanceItems(OPTS);
    state.sent = [];

    const zweiter = await notifyNewHighRelevanceItems(OPTS);
    expect(zweiter.pushSent).toBe(0);
    expect(state.sent).toEqual([]);
  });

  it('sendet nicht erneut, nachdem das Item gelöscht und neu eingelesen wurde', async () => {
    // Genau der Fall, der die Push-Schleife erzeugte: Retention oder der
    // Quellen-Deckel entfernen das Item, der nächste Abruf legt es mit
    // derselben deterministischen ID wieder an.
    state.news = [item('a1', 'Blankoverordnung kommt')];
    await notifyNewHighRelevanceItems(OPTS);
    state.sent = [];

    state.news = [];
    await notifyNewHighRelevanceItems(OPTS);
    state.news = [item('a1', 'Blankoverordnung kommt')];

    const nachWiederkehr = await notifyNewHighRelevanceItems(OPTS);
    expect(nachWiederkehr.pushSent).toBe(0);
    expect(state.sent).toEqual([]);
  });

  it('vermerkt nichts, solange kein Gerät angemeldet ist', async () => {
    state.subscriptions = [];
    state.news = [item('a1', 'Blankoverordnung kommt')];

    await notifyNewHighRelevanceItems(OPTS);
    expect(state.notified.size).toBe(0);

    // Nach der ersten Anmeldung muss die Meldung nachgeholt werden.
    state.subscriptions = [{ endpoint: 'https://push.test/a', keys: { p256dh: 'x', auth: 'y' } }];
    const result = await notifyNewHighRelevanceItems(OPTS);
    expect(result.pushSent).toBe(1);
  });

  it('ignoriert Items unter dem Schwellwert', async () => {
    state.news = [item('a1', 'Randnotiz', 8)];
    expect((await notifyNewHighRelevanceItems(OPTS)).pushSent).toBe(0);
  });

  it('benachrichtigt über ein neues Video trotz Score unter dem Schwellwert', async () => {
    state.news = [video('v1', 'Gefahr beim Hausbesuch', 2)];
    const res = await notifyNewHighRelevanceItems(OPTS);
    expect(res.pushSent).toBe(1);
    expect(state.sent).toEqual(['Gefahr beim Hausbesuch']);
  });

  it('benachrichtigt nicht über ein Video außerhalb der Frist', async () => {
    // Verhindert, dass ein nachträglich eingelesenes Archiv Dutzende
    // Pushes auf einmal auslöst
    state.news = [video('v2', 'Alte Folge', 90)];
    const res = await notifyNewHighRelevanceItems(OPTS);
    expect(res.pushSent).toBe(0);
  });

  it('benachrichtigt über dasselbe Video kein zweites Mal', async () => {
    state.news = [video('v3', 'Unangekündigte Besuche in Praxen', 1)];
    await notifyNewHighRelevanceItems(OPTS);
    state.sent = [];
    await notifyNewHighRelevanceItems(OPTS);
    expect(state.sent).toEqual([]);
  });
});
