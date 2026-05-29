import { describe, it, expect } from 'vitest';
import { scoreByKeywords } from '../../src/lib/relevance/keywords';

/**
 * Tests für die Keyword-basierte Relevanz-Bewertung.
 * Stellt sicher, dass die Schlagwortlisten und die Entscheidungslogik
 * (accept / reject / gray) wie beabsichtigt funktionieren.
 */

const baseInput = {
  sourceName: 'Generic',
  sourceCategory: 'fachlich',
};

describe('scoreByKeywords', () => {
  describe('Strong-Whitelist-Treffer', () => {
    it('bewertet "Manuelle Therapie" hochrelevant', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Manuelle Therapie bei chronischen Nackenschmerzen',
      });
      expect(r.score).toBeGreaterThanOrEqual(7);
      expect(r.hits.strong.length).toBeGreaterThan(0);
    });

    it('akzeptiert Items mit "physiotherap" als strong-Match', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Neue Studie zur Physiotherapie bei LWS-Beschwerden',
      });
      expect(r.score).toBeGreaterThanOrEqual(7);
      expect(r.hits.strong.some((h) => h.includes('physiotherap'))).toBe(true);
    });

    it('akzeptiert "Blankoverordnung"', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Blankoverordnung: Was Praxen wissen müssen',
      });
      expect(r.score).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Hard-Blacklist-Treffer', () => {
    it('lehnt "Apothekenreform" klar ab', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Bundestag beschließt Apothekenreform',
      });
      expect(r.score).toBeLessThanOrEqual(2);
      expect(r.decision).toBe('reject');
    });

    it('lehnt "Tabakkontrolle" ab', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Tabakkontrollpolitik 2026: Neue Maßnahmen',
      });
      expect(r.score).toBeLessThanOrEqual(2);
    });

    it('lehnt zahnmedizinische Themen ab', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Zahnärzte fordern höhere Vergütung',
      });
      expect(r.score).toBeLessThanOrEqual(2);
    });
  });

  describe('Soft-Blacklist mit Rescue', () => {
    it('mildert "Krebs" wenn "Lymphdrainage" vorkommt', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Lymphdrainage bei Brustkrebs-Patientinnen — neue Empfehlungen',
      });
      // Rescue greift, Score sollte > reine Blacklist-Treffer sein
      expect(r.score).toBeGreaterThan(3);
    });

    it('mildert "Covid" wenn "Long-COVID" und "Rehabilitation"', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Rehabilitation bei Long-COVID: physiotherapeutische Ansätze',
      });
      expect(r.score).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Source-Bias', () => {
    it('Verbands-Quelle bekommt Bonus auch ohne Keywords', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Neue Geschäftsstelle eröffnet',
        sourceName: 'IFK Aktuelles',
      });
      // +3 Source-Bias addiert zum Neutral-Score 5
      expect(r.score).toBeGreaterThanOrEqual(7);
    });

    it('RKI bekommt starken Malus', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Allgemeine Gesundheitsbeobachtung',
        sourceName: 'Robert Koch-Institut Pressemitteilungen',
      });
      expect(r.score).toBeLessThanOrEqual(3);
    });
  });

  describe('Entscheidungs-Logik', () => {
    it('decision=accept nur bei Score >= 8 UND strong-Hit', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Physiotherapie und Heilmittelversorgung',
        sourceName: 'VPT Bundesverband',
      });
      expect(r.decision).toBe('accept');
    });

    it('decision=gray bei nur Source-Bias ohne strong-Hit', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Quartalsmeldung aus der Geschäftsstelle',
        sourceName: 'IFK Aktuelles',
      });
      // Score 8 (5 + 3 Source) aber keine strong-Hits → gray (AI prüft nach)
      expect(r.decision).toBe('gray');
    });

    it('decision=reject bei Junk-Titel-Pattern', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Abonnementpreise',
        sourceName: 'IFK Aktuelles',
      });
      expect(r.decision).toBe('reject');
      expect(r.score).toBe(0);
    });

    it('decision=reject bei sehr kurzem Titel (< 20 Zeichen)', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Pressemitteilung',
        sourceName: 'IFK Aktuelles',
      });
      expect(r.decision).toBe('reject');
    });

    it('decision=reject bei Score <= 1', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Pressemitteilungen Apotheken Tabak',
        sourceName: 'BMG Pressemitteilungen',
      });
      expect(r.decision).toBe('reject');
    });
  });

  describe('Score-Range', () => {
    it('clampt Score auf 0-10', () => {
      // Sehr viele strong-Hits → trotzdem max 10
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Physiotherapie Manuelle Therapie Heilmittelversorgung Blankoverordnung Krankengymnastik',
        sourceName: 'Thieme physioscience (RSS)',
      });
      expect(r.score).toBeLessThanOrEqual(10);
      expect(r.score).toBeGreaterThanOrEqual(0);
    });

    it('Reason enthält Quellen-Bias bei nicht-null Quellen', () => {
      const r = scoreByKeywords({
        ...baseInput,
        title: 'Quartalsmeldung aus dem Vorstand für Mitglieder',
        sourceName: 'IFK Aktuelles',
      });
      expect(r.reason).toContain('src:');
    });
  });
});
