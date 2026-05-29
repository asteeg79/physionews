/**
 * Schlagwortliste für die Physiotherapie-Relevanz-Klassifizierung.
 *
 * Konventionen:
 *  - Alle Begriffe werden case-insensitive verglichen
 *  - Mehrwort-Begriffe werden als Substring gematcht
 *  - Begriffe sind so spezifisch wie möglich, um false positives zu vermeiden
 */

/**
 * Hochrelevante Begriffe — bei Treffer starker Score-Anstieg.
 * Methoden, Konzepte und Diagnosen, die direkt im Physio-Alltag relevant sind.
 */
export const STRONG_WHITELIST = [
  // Berufsbezeichnung und unmittelbares Umfeld
  'physiotherap',
  'krankengymnast',
  'kg-zns',
  'kg-atmung',
  'kg-gerät',
  'kg-orth',
  'heilmittelerbring',
  'heilmittel-verordnung',
  'heilmittelverordnung',
  'heilmittelvergütung',
  'heilmittelversorgung',
  'heilmittelpreis',
  'heilmittelkatalog',
  'heilmittelrichtlinie',
  'blankoverordnung',
  'direktzugang',
  'modellvorhaben physio',
  'modellprojekt physio',
  'vorbehaltsaufgab',
  'akademisierung physio',
  'spv', // Sektorenübergreifende Versorgung
  'shv', // Spitzenverband der Heilmittelverbände

  // Methoden und Techniken
  'manuelle therapie',
  'manuelle lymphdrainage',
  'lymphdrainage',
  ' mld ',
  'bobath',
  'vojta',
  ' pnf ',
  'kinesio-taping',
  'medizinische trainingstherapie',
  'medizinisches trainingstherap',
  'schlingentisch',
  'craniosacral',
  'craniofacial',
  'manualtherap',

  // Verbände und Politik (spezifisch Physio)
  'physio deutschland',
  'physio-deutschland',
  'zvk-verband',
  'verband für physiotherap',
  'verband physiotherap',
  'ifk-verband',
  'bundesverband selbstständiger physio',
  'dvmt',
  'igpt', // Interessengemeinschaft
];

/**
 * Mittel-relevante Begriffe — bei Treffer leichter Score-Anstieg.
 * Anatomische und neurologische Themen, bei denen Physiotherapie eine Rolle spielt.
 */
export const MEDIUM_WHITELIST = [
  // Anatomie/Muskuloskelettal
  'wirbelsäule',
  'bandscheib',
  'lws ',
  'hws ',
  'bws ',
  'iliosakral',
  'iliosacral',
  'rückenschmerz',
  'kreuzschmerz',
  'spinalkanal',
  'skoliose',
  'osteoporose',
  'arthrose',
  'arthritis',
  'rheuma',
  'osteopen',
  'tendinose',
  'tendinitis',
  'rotatorenmanschette',
  'impingement',
  'kreuzband',
  'meniskus',
  'achillessehne',
  'tep',
  'hüft-tep',
  'knie-tep',
  'schulterprothese',
  'gonarthrose',
  'coxarthrose',
  'patellaspitzensyndrom',

  // Neurologisch (Schwerpunkt Physiotherapie)
  'schlaganfall',
  'multiple sklerose',
  'ms-erkrank',
  'parkinson',
  'querschnittlähm',
  'querschnitt',
  'paraplegie',
  'hemiparese',
  'spastik',
  'apoplex',
  'icp ', // infantile Cerebralparese
  'cerebralparese',
  'cerebral palsy',
  'morbus parkinson',

  // Kardio/Pulmo (Physio-relevant)
  'copd',
  'mukoviszidose',
  'pneumonie-rehabilitation',
  'atemtherapie',
  'lungenrehabilitation',
  'pulmonale rehabil',
  'herzrehabilitation',
  'kardiologische rehabil',

  // Reha & Geriatrie
  'rehabilitation',
  'reha-',
  'frührehabilitation',
  'mobilisation',
  'sturzprävention',
  'geriatri',
  'gangbild',
  'gangstörung',
  'gleichgewicht',
  'propriozeption',
  'tiefensensibil',

  // Sport-Physio
  'sportmedizin',
  'sportverletzung',
  'sportphysiotherap',
  'leistungssport-rehabil',
  'rückkehr in den sport',
  'return-to-sport',
  'return to play',

  // Pädiatrie-Physio
  'kinderphysiotherap',
  'pädiatrische physio',
  'entwicklungsstörung',
  'frühförderung',
];

/**
 * Begriffe, die einen physiotherapeutischen Kontext stark vermuten lassen
 * (z.B. weil sie Behandlungs- oder Studienkontext sind).
 */
export const CONTEXTUAL_WHITELIST = [
  'evidenz',
  'leitlinie',
  's3-leitlinie',
  's2k-leitlinie',
  'metaanalyse',
  'meta-analyse',
  'rct ',
  'randomisierte',
  'cochrane-review',
  'systematic review',
  'kohortenstudie',
  'awmf',
  'bewegungstherap',
  'übungsprogramm',
  'übungstherap',
  'trainingsstudie',
  'physikalische therapie',
];

/**
 * Klar irrelevante Themen — bei Treffer starker Score-Abzug.
 * Diese Themen tauchen besonders in BMG/RKI/G-BA-Quellen auf.
 */
export const HARD_BLACKLIST = [
  // Apothekenwesen
  'apothek',
  'apothekenreform',
  'apothekenbetrieb',
  'arzneimittel-versorgung',
  'medikamenten-engpass',
  'medikamenten-knappheit',
  'lieferengpass',

  // Cannabis / Drogenpolitik
  'cannabis-gesetz',
  'cannabisanbau',
  'cannabis-medizin',
  'tabak',
  'rauchstopp',
  'tabakerzeugnis',
  'tabakkontroll',

  // Krankenhausfinanzierung
  'krankenhausvergütung',
  'krankenhausplanung',
  'krankenhausfinanzier',
  'dRG-system',
  'fallpauschal',

  // Andere Berufsgruppen
  'kassenärztliche bundesvereinigung',
  'kbv-news',
  'tierheilbehandlung',
  'veterinär',
  'lebensmittel',
  'zahnmedizin',
  'zahnärzt',
  'zahnärztekammer',
  'parodontitis',
  'mundhygiene',
  'kariesprävention',
  'augenheilkund',
  'augenarzt',
  'kataract',
  'hörgeräteversorgung',
  'optiker',

  // Onkologie/Pharma (ohne Reha-Bezug)
  'wirkstoff',
  'pharmaindustrie',
  'arzneimittelmarkt',
  'amnog',
  'zusatznutzen-bewertung',

  // Ethik / Lebensende
  'organspende',
  'transplantation',
  'sterbehilfe',
  'embryonenschutz',
  'reproduktionsmedizin',

  // Allgemein-Politik
  'wha-genf',
  'weltgesundheitsversammlung',
  'g7-gipfel',
  'g20-gesundheit',

  // Junk / Navigation
  'newsletter-anmeldung',
  'rss-feed',
  'mediathek',
  'pressekontakt',
  'soziale-medien',
  'instagram',
  'facebook',
  'pressemitteilungen und meldungen',
  'tag der offenen tür',
  'tag des gesundheitsamt',
];

/**
 * Weiche Blacklist — leichter Score-Abzug. Themen, die meistens nicht relevant
 * sind, aber Ausnahmen erlauben (z.B. Reha-Bezug, Long-COVID).
 */
export const SOFT_BLACKLIST = [
  // Infektiologie
  'tuberkulose',
  'antibiotika',
  'malaria',
  'masern',
  'mumps',
  'röteln',
  'influenza',
  'corona',
  'covid',
  'sars-cov',
  'pandemie',
  'tropenmedizin',
  'impfung',
  'impfstoff',
  'impfquote',
  'meldepflicht',
  'rki-surveill',

  // Statistik / Epidemiologie ohne Physio
  'epidemiologisch',
  'global burden',
  'inzidenz',
  'prävalenz',
  'sterblichkeit',
  'mortalität',
  'gesundheitsmonitoring',
  'journal of health monitoring',

  // Onkologie / Spezialmedizin ohne Reha
  'krebsregister',
  'krebs in deutschland',
  'krebsforschung',
  'onkologie-news',
  'tumorzentrum',
  'chemotherapie',
  'bestrahlung',
  'palliativmedizin',

  // Allgemein-Verwaltung / Networking
  'public-health-konferenz',
  'fachtagung',
  'mitgliederversammlung',
  'jahrestagung',
  'kongressankündigung',
  'gesundheitskongress',
  'bronzepartner',
  'silberpartner',
  'goldpartner',
  'sponsor',

  // Internes / Junk
  'newsletter',
  'umfrage starten',
  'umfrage-aufruf',
  'fristenbericht',
  'jahresbericht',
  'bilanzpressekonferenz',
  'methodenpapier',
  'methodenpapiere',
];

/**
 * Begriffe, die eine Blacklist-Eintragung "kompensieren" — z.B. wenn
 * "Krebs" zusammen mit "Onkologische Reha" oder "Lymphdrainage" steht.
 */
export const BLACKLIST_RESCUE = [
  'rehabilitation',
  'reha-',
  'lymphdrainage',
  'physiotherap',
  'krankengymnast',
  'mobilisation',
  'bewegungstherap',
  'long covid',
  'long-covid',
  'post-covid',
  'post-akut',
  'fatigue-management',
];

export interface ScoreInput {
  title: string;
  summary?: string | null;
  sourceName: string;
  sourceCategory: string;
}

export interface ScoreResult {
  score: number; // 0-10
  reason: string;
  decision: 'accept' | 'reject' | 'gray';
  hits: { strong: string[]; medium: string[]; contextual: string[]; hard: string[]; soft: string[]; rescue: string[] };
}

/**
 * Source-Gewichtungen für die Relevanz-Berechnung.
 * Berufsverbände → starker Bonus, allgemeine Gesundheits-Quellen → leichter Malus.
 */
const SOURCE_BIAS: Record<string, number> = {
  // Berufsverbände — alle Items relevant
  'IFK Aktuelles': 3,
  'VPT Bundesverband': 3,
  'VPT NRW Aktuelles': 3,
  'VDB Physiotherapieverband NRW': 3,
  'Physio Deutschland (ZVK)': 3,
  'DVMT — Aktuelles': 3,

  // Recht (heilmittel-spezifisch)
  'RA Benjamin Alt — Aktuelles': 3,
  'RA Benjamin Alt — Artikel': 3,
  'RA Benjamin Alt — YouTube': 3,

  // Evidenz / Fachpresse
  'Thieme physioscience (RSS)': 3,
  'Thieme Journal KG/Manuelle Therapie': 3,
  'Thieme Newsletter Landing': 2,
  'Cochrane für Physiotherapeuten': 3,
  'Cochrane Deutschland — News': 0, // gemischt
  'physio.de Newsletter-Archiv': 2,
  // physiotherapeuten.de via Google News (Original-Seite hat Brightboy-Schutz)
  'physiotherapeuten.de — Wirbelsäule (via Google News)': 3,
  'physiotherapeuten.de — untere Extremität (via Google News)': 3,
  'physiotherapeuten.de — obere Extremität (via Google News)': 3,
  'physiotherapeuten.de — Neurologie & Sport (via Google News)': 3,
  // Neue Fachquellen
  'pt-online.de (via Google News)': 3, // Pflaum-Verlag Fachzeitschrift
  'Springer Manualmedizin (via Google News)': 3, // gezielt manuelle Therapie/Medizin
  'SpringerMedizin Physio (via Google News)': 3, // Physiotherapie + Rehabilitation
  'DGOU Pressemitteilungen': 0, // Orthopädie/Unfallchirurgie, gemischt
  'AOK WIdO — News & Presse': 0, // Wissenschaftsinstitut, gemischt
  'BARMER Presseinformationen': -1, // Kasse, eher allgemein-politisch

  // Allgemein-Gesundheit — stärker abwerten, da viele off-topic Items
  'BMG Pressemitteilungen': -2,
  'Robert Koch-Institut Pressemitteilungen': -3,
  'G-BA Pressemitteilungen': -2,
  'DGSP — News': -1, // Sportmedizin gemischt mit Networking/Sponsoring
  'AWMF Leitlinien (aktuell)': 1, // leichter Bonus für Leitlinien

  // Ärzteblatt: stark gemischt
  'Ärzteblatt RSS Übersicht': -2,
};

/**
 * Berechnet einen Relevanz-Score (0-10) für ein News-Item auf Basis von
 * Schlagwörtern und Quelle. Liefert auch eine Begründung und eine
 * Entscheidung: accept / reject / gray (Gray-Items werden an Gemini gegeben).
 */
/**
 * Junk-Titel-Patterns — Navigations- und Verwaltungs-Phrasen, die zwar
 * gelegentlich von Adaptern miterfasst werden, aber nie Artikel-Inhalt
 * tragen. Treffer → sofort score=0, decision='reject', kein AI-Call.
 */
const JUNK_TITLE_PATTERNS: RegExp[] = [
  /^abonnement/i,
  /^informationen für autoren$/i,
  /^cme zertifizierte fortbildung$/i,
  /^diese zeitschrift ist in e\.med/i,
  /^springermedizin\.de$/i,
  /^pressemitteilungen$/i,
  /^pressemitteilungen und meldungen$/i,
  /^newsletter/i,
  /^mediathek$/i,
  /^impressum$/i,
  /^datenschutz/i,
  /^kontakt$/i,
  /^startseite$/i,
  /^mehr lesen$/i,
  /^weiterlesen$/i,
  /^zur (n[äa]chsten|vorherigen|ersten|letzten) seite$/i,
  /^zur übersicht$/i,
  /^artikel teilen$/i,
];

export function scoreByKeywords(input: ScoreInput): ScoreResult {
  const titleTrim = input.title.trim();
  // Junk-Frühfilter — vor jedem anderen Scoring
  if (JUNK_TITLE_PATTERNS.some((re) => re.test(titleTrim)) || titleTrim.length < 20) {
    return {
      score: 0,
      reason: `junk-title: "${titleTrim.slice(0, 40)}"`,
      decision: 'reject',
      hits: { strong: [], medium: [], contextual: [], hard: [], soft: [], rescue: [] },
    };
  }

  const text = `${input.title} ${input.summary ?? ''}`.toLowerCase();
  const sourceBias = SOURCE_BIAS[input.sourceName] ?? 0;

  const hits = {
    strong: STRONG_WHITELIST.filter((kw) => text.includes(kw)),
    medium: MEDIUM_WHITELIST.filter((kw) => text.includes(kw)),
    contextual: CONTEXTUAL_WHITELIST.filter((kw) => text.includes(kw)),
    hard: HARD_BLACKLIST.filter((kw) => text.includes(kw)),
    soft: SOFT_BLACKLIST.filter((kw) => text.includes(kw)),
    rescue: BLACKLIST_RESCUE.filter((kw) => text.includes(kw)),
  };

  let score = 5; // neutraler Start

  // Whitelist-Punkte
  score += Math.min(hits.strong.length * 3, 6); // max +6
  score += Math.min(hits.medium.length * 1.5, 4); // max +4
  score += Math.min(hits.contextual.length * 0.5, 2); // max +2

  // Blacklist-Abzug — aber "Rescue"-Treffer mindern den Abzug
  const hardPenalty = hits.hard.length * 5; // jeder harte Hit -5
  const softPenalty = hits.soft.length * 2; // jeder weiche Hit -2
  const rescueRelief = Math.min(hits.rescue.length * 2.5, hardPenalty + softPenalty);
  score -= hardPenalty + softPenalty - rescueRelief;

  // Source-Bias
  score += sourceBias;

  // Auf 0-10 clampen
  score = Math.max(0, Math.min(10, Math.round(score)));

  // Begründung kompakt zusammenstellen
  const reasonParts: string[] = [];
  if (hits.strong.length > 0) reasonParts.push(`+strong:${hits.strong.slice(0, 2).join(',')}`);
  if (hits.medium.length > 0) reasonParts.push(`+med:${hits.medium.slice(0, 2).join(',')}`);
  if (hits.hard.length > 0) reasonParts.push(`-hard:${hits.hard.slice(0, 2).join(',')}`);
  if (hits.soft.length > 0) reasonParts.push(`-soft:${hits.soft.slice(0, 2).join(',')}`);
  if (sourceBias !== 0) reasonParts.push(`src:${sourceBias > 0 ? '+' : ''}${sourceBias}`);
  const reason = reasonParts.join(' | ') || 'neutral';

  // Entscheidung — AI großzügiger einsetzen (Tokens haben wir):
  // accept (Skip Gemini) NUR bei sehr klaren Treffern: score >= 9 UND
  //   mindestens 2 strong-Hits (eindeutige Praxis-Relevanz)
  // reject (Skip Gemini) nur bei klar negativen (score <= 1)
  // Alles dazwischen → Gemini-Befragung — auch bei „guten" Score 7-8,
  //   weil das oft nur Source-Bonus ohne echte Praxisrelevanz war.
  let decision: ScoreResult['decision'];
  if (score >= 9 && hits.strong.length >= 2) decision = 'accept';
  else if (score <= 1) decision = 'reject';
  else decision = 'gray';

  return { score, reason, decision, hits };
}
