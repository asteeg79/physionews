/**
 * GET /api/gemini-usage — aktueller Gemini-Tagesverbrauch.
 *
 * Wird vom Settings-UI gepollt, damit der Nutzer sehen kann,
 * wie viel KI-Budget heute schon verwendet wurde.
 */
import { getQuotaStatus } from '@/lib/relevance/gemini-quota';

export const revalidate = 30;

export async function GET() {
  const status = await getQuotaStatus();
  return Response.json(status, {
    headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' },
  });
}
