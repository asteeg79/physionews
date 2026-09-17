/**
 * Refresh-on-Open — vom Frontend aufgerufen, wenn die App geöffnet wird
 * und der letzte Refresh zu lange her ist.
 *
 * Seit die Daten als JSON-Dateien im Repo liegen, läuft der eigentliche
 * Abruf nicht mehr hier, sondern in GitHub Actions. Diese Route prüft nur
 * noch, ob ein Lauf fällig ist, und stößt den Workflow per
 * `workflow_dispatch` an. Bis die neuen Daten live sind, vergehen ein
 * paar Minuten (Pipeline + Vercel-Deploy) — deshalb meldet die Antwort
 * `dispatched` statt einer Anzahl neuer Items.
 *
 * Schutzmaßnahmen:
 *  - Rate-Limit 1× pro 5 Minuten pro IP
 *  - Refresh-Fenster und Mindest-Intervall aus den Einstellungen
 */
import { getSettings } from '@/data/settings';
import { dispatchWorkflow } from '@/data/github';
import { getBerlinHour } from '@/lib/timezone';
import { rateLimit, clientIpFrom } from '@/lib/rate-limit';
import { writeErrorResponse } from '@/lib/write-guard';

/** Dateiname des Pipeline-Workflows in .github/workflows/. */
const PIPELINE_WORKFLOW = 'cron-refresh.yml';

export async function POST(req: Request) {
  const ip = clientIpFrom(req.headers);
  const limit = rateLimit(`refresh:${ip}`, { limit: 1, windowSeconds: 300 });
  if (!limit.allowed) {
    return Response.json(
      { skipped: true, reason: 'rate_limited', resetIn: limit.resetIn },
      { status: 429 }
    );
  }

  const settings = await getSettings();

  const berlinHour = getBerlinHour();
  if (berlinHour < settings.refreshWindowStart || berlinHour >= settings.refreshWindowEnd) {
    return Response.json({ skipped: true, reason: 'outside_window', berlinHour });
  }

  if (settings.lastGlobalRefreshAt) {
    const ageMs = Date.now() - settings.lastGlobalRefreshAt.getTime();
    const intervalMs = settings.refreshIntervalHours * 60 * 60 * 1000;
    if (ageMs < intervalMs) {
      return Response.json({
        skipped: true,
        reason: 'too_recent',
        lastRefreshAt: settings.lastGlobalRefreshAt.toISOString(),
        nextRefreshIn: Math.ceil((intervalMs - ageMs) / 1000),
      });
    }
  }

  console.log(`[OnDemand] Pipeline-Lauf angestoßen von ${ip}`);

  try {
    await dispatchWorkflow(PIPELINE_WORKFLOW);
  } catch (err) {
    return writeErrorResponse(err);
  }

  return Response.json({ ok: true, dispatched: true, triggeredBy: 'on-demand' });
}
