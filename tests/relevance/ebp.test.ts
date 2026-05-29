import { describe, it, expect } from 'vitest';
import { hasEvidenceTopic, EVIDENCE_TOPICS, TOPIC_TAXONOMY } from '../../src/lib/relevance/topics';

describe('EBP / Evidenz-Tags', () => {
  it('erkennt Items mit Evidenz-Tag', () => {
    expect(hasEvidenceTopic(['Wirbelsäule', 'RCT'])).toBe(true);
    expect(hasEvidenceTopic(['Leitlinie', 'Reha'])).toBe(true);
    expect(hasEvidenceTopic(['Cochrane-Review'])).toBe(true);
    expect(hasEvidenceTopic(['Meta-Analyse'])).toBe(true);
    expect(hasEvidenceTopic(['Systematic Review'])).toBe(true);
    expect(hasEvidenceTopic(['S3-Leitlinie'])).toBe(true);
  });

  it('erkennt Items ohne Evidenz-Tag', () => {
    expect(hasEvidenceTopic(['Wirbelsäule', 'Manuelle Therapie'])).toBe(false);
    expect(hasEvidenceTopic(['Berufsverband', 'Veranstaltung'])).toBe(false);
    expect(hasEvidenceTopic([])).toBe(false);
  });

  it('alle EVIDENCE_TOPICS sind in TOPIC_TAXONOMY enthalten', () => {
    for (const t of EVIDENCE_TOPICS) {
      expect(TOPIC_TAXONOMY).toContain(t);
    }
  });

  it('enthält die erwarteten Studientypen', () => {
    expect(EVIDENCE_TOPICS).toContain('RCT');
    expect(EVIDENCE_TOPICS).toContain('Meta-Analyse');
    expect(EVIDENCE_TOPICS).toContain('Systematic Review');
    expect(EVIDENCE_TOPICS).toContain('S3-Leitlinie');
  });
});
