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

const GEMINI_MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Du bewertest Nachrichten-Titel auf Relevanz für deutsche Physiotherapeut:innen.
Skala 0-10: 10 = direkte Physio-Praxis-Relevanz (Methoden, Heilmittel, Berufspolitik, Reha,
muskuloskelettal/neurol. Diagnosen). 0 = irrelevant (allg. Gesundheit ohne Physio-Bezug,
Apotheken/Pharma, Veterinärmedizin, Zahnmedizin, allg. Infektiologie).
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
      maxOutputTokens: 2048,
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
