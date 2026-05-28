import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveChannelId } from '../../src/lib/adapters/youtube';

describe('resolveChannelId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extrahiert channel_id direkt aus Feed-URL', async () => {
    const id = await resolveChannelId('https://www.youtube.com/feeds/videos.xml?channel_id=UCABCDEF12345_XYZ');
    expect(id).toBe('UCABCDEF12345_XYZ');
  });

  it('extrahiert channel_id aus /channel/-URL', async () => {
    const id = await resolveChannelId('https://www.youtube.com/channel/UCdeadbeef0123456789');
    expect(id).toBe('UCdeadbeef0123456789');
  });

  it('extrahiert channel_id aus @Handle-Seite via externalId', async () => {
    global.fetch = vi.fn(async () =>
      new Response('<html>...<script>{"externalId":"UC-A7odeHZYqX0JLU2TIOjhg"}</script>...</html>', {
        status: 200,
      })
    ) as unknown as typeof fetch;
    const id = await resolveChannelId('https://www.youtube.com/@RechtsanwaltAlt');
    expect(id).toBe('UC-A7odeHZYqX0JLU2TIOjhg');
  });

  it('fällt auf meta itemprop zurück', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        '<html><head><meta itemprop="identifier" content="UCfallback1234567890_X"></head><body></body></html>',
        { status: 200 }
      )
    ) as unknown as typeof fetch;
    const id = await resolveChannelId('https://www.youtube.com/@TestChannel');
    expect(id).toBe('UCfallback1234567890_X');
  });

  it('gibt null zurück bei Netzwerkfehler', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('Network');
    }) as unknown as typeof fetch;
    const id = await resolveChannelId('https://www.youtube.com/@brokenexample');
    expect(id).toBeNull();
  });
});
