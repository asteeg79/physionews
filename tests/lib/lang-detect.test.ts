import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/lib/lang-detect';

describe('detectLanguage', () => {
  it('erkennt Umlaute als deutsches Signal', () => {
    expect(
      detectLanguage('Wirkt Physiotherapie bei HWS-Syndrom? Eine Übersicht der Studien')
    ).toBe('de');
    expect(detectLanguage('Bandscheiben backstage — neue Studie zur Rückenmuskulatur')).toBe('de');
    expect(detectLanguage('Die neue physiotherapie ist da — Ausgabe für Mai')).toBe('de');
  });

  it('erkennt deutsche Funktionswörter ohne Umlaute', () => {
    expect(
      detectLanguage(
        'Der Bundestag hat am Freitag das Gesetz zur Stabilisierung der Beitragssaetze beschlossen'
      )
    ).toBe('de');
  });

  it('erkennt englische Texte', () => {
    expect(
      detectLanguage('The Effectiveness of Pain Neuroscience Education in the Practice Setting')
    ).toBe('en');
    expect(detectLanguage('Physical Rehabilitation Approaches for Stroke Recovery')).toBe('en');
  });

  it('liefert unknown bei sehr kurzen Texten', () => {
    expect(detectLanguage('CMD')).toBe('unknown');
    expect(detectLanguage('Knie-TEP')).toBe('unknown');
  });

  it('liefert unknown bei mehrdeutigen Texten', () => {
    // Keine klaren Signale auf beiden Seiten
    expect(detectLanguage('xxxxxxx yyyyyy zzzzzz qqqqqqq')).toBe('unknown');
  });
});
