import { loadNews, saveNews } from '@/data/news';
import { updateSettings } from '@/data/settings';
import { writeErrorResponse } from '@/lib/write-guard';

/**
 * Löscht alle gespeicherten News-Items.
 * `lastGlobalRefreshAt` wird auf null gesetzt, damit der nächste Refresh
 * sofort durchläuft statt am Intervall-Check zu scheitern.
 */
export async function POST() {
  try {
    const deleted = (await loadNews()).length;
    await saveNews([], 'chore(data): News-Cache geleert');
    await updateSettings({ lastGlobalRefreshAt: null });
    return Response.json({ ok: true, deleted });
  } catch (err) {
    return writeErrorResponse(err);
  }
}
