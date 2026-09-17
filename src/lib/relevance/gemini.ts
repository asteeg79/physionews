/**
 * Gemini Flash 2.0 Batch-Klassifizierer für Grauzonen-Items.
 *
 * Token-Optimierungen:
 *  - Batch (default 30 Items) → System-Prompt amortisiert sich
 *  - Nur Titel + Quelle als Input (kein Summary)
 *  - JSON-Schema-Output → keine Text-Drumherum-Tokens
 *  - Minimaler System-Prompt
 *  - Skipt komplett, wenn GEMINI_API_KEY fehlt (Fallback auf Keyword-Score)
 */

// gemini-2.5-flash-lite ist die günstigste Variante im Free-Tier und reicht
// für unsere Klassifizierungs-Aufgabe (binäre/lineare Bewertung).
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

import { TOPIC_TAXONOMY, filterToValidTopics } from './topics';

/**
 * Version des Bewertungsmaßstabs. Fließt in den Cache-Schlüssel ein — eine
 * Änderung am Prompt macht damit automatisch alle gecachten Bewertungen
 * ungültig, statt sie stillschweigend weiterzuverwenden.
 */
export const RUBRIC_VERSION = 2;

const SYSTEM_PROMPT_TEMPLATE = `Du bewertest Nachrichten-Titel STRENG auf Relevanz für deutsche Physiotherapeut:innen in der Praxis.

LEITFRAGE: Ändert sich durch diese Meldung etwas an der Arbeit, der Abrechnung, der Ausbildung oder dem fachlichen Wissen einer Physiotherapeutin? Wenn du das nicht klar bejahen kannst, ist die Meldung NICHT relevant.

Bewertungs-Rubric (Skala 0-10):
- 9-10: Unmittelbar. Heilmittelverordnung, Blankoverordnung, Direktzugang, GKV-Vergütung für Heilmittel, Zertifikatspositionen, Abrechnungsregeln, neue Leitlinien oder Studien zu physiotherapeutischen Verfahren.
- 7-8: Klar relevant. Berufspolitik der Physio-Verbände mit Folgen für die Praxis, Recht und Abrechnung für Heilmittelerbringer, Studien zu Reha und Bewegungstherapie, Aus- und Fortbildung in der Physiotherapie.
- 4-6: Nur wenn ein konkreter Bezug zur Physiotherapie erkennbar ist, dieser aber mittelbar bleibt.
- 0-3: Alles Übrige. Dazu gehört AUSDRÜCKLICH Gesundheitspolitik ohne Physio-Bezug: Gremien- und Personalmeldungen, Förderprogramme und Innovationsfonds, Verfahrensordnungen, Finanzberichte der GKV, Screening- und Vorsorgeprogramme, Krankenhaus- und Psychiatrie-Themen, Pharma, Zahn- und Augenmedizin, Infektiologie, allgemeine Gesundheitsmonitorings, Verbandsverwaltung, Veranstaltungs- und Kongresshinweise.

WICHTIG: Eine Meldung ist NICHT dadurch relevant, dass sie aus einer physiotherapienahen Quelle stammt oder irgendwie das Gesundheitswesen betrifft. Entscheidend ist allein der erkennbare Bezug zur physiotherapeutischen Praxis. Im Zweifel NIEDRIGER bewerten.

Zusätzlich: weise jedem Item 0-3 Themen-Tags aus dieser EXAKTEN Liste zu (nichts anderes):
${TOPIC_TAXONOMY.join(', ')}

Tags ordnen das Item thematisch ein — sie sagen NICHTS über die Relevanz aus. Wenn nichts passt, leeres Array.

EVIDENZ-TAGS sind besonders wichtig: vergib „Leitlinie", „S3-Leitlinie", „S2k-Leitlinie",
„RCT", „Meta-Analyse", „Systematic Review" oder „Cochrane-Review", wenn das Item
klar diesen Studientyp benennt. Bei „Studie" allgemein nutze „Studie".

Antworte als JSON-Array in derselben Reihenfolge wie Input.`;

const SYSTEM_PROMPT = SYSTEM_PROMPT_TEMPLATE;

export interface GeminiInput {
  id: string;
  title: string;
  sourceName: string;
}

export interface GeminiResult {
  id: string;
  score: number; // 0-10
  reason: string; // kurzes Begründungsstichwort
  topics: string[]; // 0-3 Tags aus TOPIC_TAXONOMY
}

/**
 * Sentinel-Return für quota-Failures (429). Caller bricht damit weitere
 * Batches im selben Lauf ab, statt weiter Tokens zu verbrennen.
 */
export const GEMINI_QUOTA_EXHAUSTED = Symbol('gemini-quota-exhausted');
export type ClassifyResult = GeminiResult[] | null | typeof GEMINI_QUOTA_EXHAUSTED;

/**
 * Klassifiziert eine Liste von Items per Gemini. Liefert:
 *  - GeminiResult[]                  bei Erfolg
 *  - GEMINI_QUOTA_EXHAUSTED          bei HTTP 429 (Caller stoppt restliche Batches)
 *  - null                            bei anderen Fehlern (Caller behält Keyword-Score)
 */
export async function classifyBatch(items: GeminiInput[]): Promise<ClassifyResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || items.length === 0) return null;

  // Items kompakt formatieren
  const userInput = items
    .map((item, i) => `${i + 1}. [${item.sourceName}] ${item.title}`)
    .join('\n');

  const requestBody = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userInput }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer' }, // Index 1-basiert
            s: { type: 'integer', minimum: 0, maximum: 10 }, // score
            r: { type: 'string' }, // reason kurz
            t: {
              // topics — 0-3 Tags aus der Taxonomie
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['i', 's', 'r'],
        },
      },
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    try {
      const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Gemini] HTTP ${res.status}: ${errText.slice(0, 200)}`);
        if (res.status === 429) {
          // Quota erschöpft — Caller stoppt sofort, statt weitere Batches
          // mit garantierten 429ern zu verheizen.
          return GEMINI_QUOTA_EXHAUSTED;
        }
        if (res.status >= 500 && attempt < 2) {
          await sleep(2000);
          continue;
        }
        return null;
      }

      const data = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      const parsed = JSON.parse(text) as Array<{
        i: number;
        s: number;
        r: string;
        t?: unknown;
      }>;
      const results: GeminiResult[] = [];
      for (const entry of parsed) {
        const sourceItem = items[entry.i - 1];
        if (!sourceItem) continue;
        results.push({
          id: sourceItem.id,
          score: Math.max(0, Math.min(10, Math.round(entry.s))),
          reason: entry.r.slice(0, 100),
          topics: filterToValidTopics(entry.t),
        });
      }
      return results;
    } catch (err) {
      console.warn(`[Gemini] Versuch ${attempt} fehlgeschlagen:`, err);
      if (attempt < 2) await sleep(2000);
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Geschätzter Token-Verbrauch für Logging/Monitoring.
 * Faustregel: ~1 Token pro 4 Zeichen.
 */
export function estimateTokens(items: GeminiInput[]): number {
  const charsSys = SYSTEM_PROMPT.length;
  const charsUser = items.reduce(
    (acc, i) => acc + i.title.length + i.sourceName.length + 20,
    0
  );
  return Math.ceil((charsSys + charsUser) / 4);
}
