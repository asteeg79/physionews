import { describe, it, expect } from 'vitest';
import { cleanGoogleNewsTitle, buildGoogleNewsUrl } from '../../src/lib/adapters/google-news';

describe('cleanGoogleNewsTitle', () => {
  it('entfernt das " - Quellen-Name"-Suffix', () => {
    expect(cleanGoogleNewsTitle('Knie-TEP: Haltbarkeit - pt Zeitschrift für Physiotherapeuten')).toBe(
      'Knie-TEP: Haltbarkeit'
    );
  });

  it('lässt Titel ohne Suffix unverändert', () => {
    expect(cleanGoogleNewsTitle('Manuelle Therapie bei Nackenschmerzen')).toBe(
      'Manuelle Therapie bei Nackenschmerzen'
    );
  });

  it('behält den Original-Titel wenn er sehr kurz ist', () => {
    // Schutz vor falschem Trim bei Titeln, die NUR "X - Y" sind
    expect(cleanGoogleNewsTitle('Test - X')).toBe('Test - X');
  });

  it('trimmt nur das letzte " - Suffix"', () => {
    expect(
      cleanGoogleNewsTitle('Krankenkasse vs. Heilmittelerbringer - ein Streitfall - Spiegel')
    ).toBe('Krankenkasse vs. Heilmittelerbringer - ein Streitfall');
  });
});

describe('buildGoogleNewsUrl', () => {
  it('baut Such-URL mit DE-Locale', () => {
    const url = buildGoogleNewsUrl('site:example.com');
    expect(url).toContain('hl=de');
    expect(url).toContain('gl=DE');
    expect(url).toMatch(/ceid=DE(%3A|:)de/);
  });

  it('URL-kodiert die Query', () => {
    const url = buildGoogleNewsUrl('site:example.com (wirbelsäule OR rücken)');
    expect(url).toContain('%C3%A4'); // ä
    expect(url).toContain('%20OR%20'); // Leerzeichen
  });
});
