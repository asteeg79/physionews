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

const SYSTEM_PROMPT = `Du bewertest Nachrichten-Titel STRENG auf Relevanz für deutsche Physiotherapeut:innen in der Praxis.

Bewertungs-Rubric (Skala 0-10):
- 9-10: Hochrelevant. Direkter Bezug zu Physio-Methoden, klinischen Diagnosen (muskuloskelettal/neurolog./kardio-pulmo./päd.), neuen Evidenz/Leitlinien, Heilmittelversorgung, Heilmittelverordnung, Blankoverordnung, GKV-Vergütung, Direktzugang.
- 7-8: Klar relevant. Verbands-Berufspolitik mit Bezug zur Praxis (Vergütung, Anstellung, Fortbildung), Studien zu Reha/Bewegungstherapie, Recht/Abrechnung für Heilmittelerbringer.
- 5-6: Grenzwertig. Allgemeine Gesundheitspolitik mit möglichem indirektem Einfluss (Krankenhausreform, Notfallreform). Berufsverband-News ohne klaren Praxisbezug. Beruhigt sich auf 5, wenn nur Networking/Sponsoring.
- 3-4: Wenig relevant. Allgemeine Gesundheitsmonitoring-Reports, breite Public-Health-Themen ohne Physio-Anker, Verband-Verwaltung (Mitgliederversammlung, Bronzepartner, Fristenbericht).
- 0-2: Irrelevant. Apotheken, Pharma-Wirkstoffe, Zahn-/Augenmedizin, Infektiologie ohne Reha-Bezug, RKI-Statistiken (Krebsregister, Tuberkulose, Tabakkontrolle), Sterbehilfe/Ethik, Werbung, Newsletter-Aufrufe, "Frohe Ostern".

WICHTIG: Bei Unsicherheit eher NIEDRIGER bewerten. Wir wollen nur Items >= 4 behalten. Allgemeine Politik OHNE direkten Physio-Bezug = max 4.

Antworte als JSON-Array in derselben Reihenfolge wie Input.`;

export interface GeminiInput {
  id: string;
  title: string;
  sourceName: string;
}

export interface GeminiResult {
  id: string;
  score: number; // 0-10
  reason: string; // kurzes Begründungsstichwort
}

/**
 * Klassifiziert eine Liste von Items per Gemini. Liefert null wenn API-Key
 * fehlt oder der Call komplett scheitert (Caller behält dann Keyword-Score).
 */
export async function classifyBatch(items: GeminiInput[]): Promise<GeminiResult[] | null> {
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
          },
          required: ['i', 's', 'r'],
        },
      },
      temperature: 0.1,
      maxOutputTokens: 4096,
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

      const parsed = JSON.parse(text) as Array<{ i: number; s: number; r: string }>;
      const results: GeminiResult[] = [];
      for (const entry of parsed) {
        const sourceItem = items[entry.i - 1];
        if (!sourceItem) continue;
        results.push({
          id: sourceItem.id,
          score: Math.max(0, Math.min(10, Math.round(entry.s))),
          reason: entry.r.slice(0, 100),
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
