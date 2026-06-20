import {
  RuntimeCompletenessChecker,
  REQUIRED_DOC_TYPES,
} from './runtime-completeness-checker';

function doc(type: string, status: string) {
  return { type, status };
}

describe('RuntimeCompletenessChecker', () => {
  const checker = new RuntimeCompletenessChecker();

  it('exposes the four required document types as a fresh array', () => {
    expect(checker.requiredDocTypes()).toEqual([
      'contract',
      'transport_waybill',
      'quality_certificate',
      'acceptance_act',
    ]);
    // fresh array per call — mutating one result must not affect the next
    checker.requiredDocTypes().push('tampered');
    expect(checker.requiredDocTypes()).toHaveLength(4);
    expect(REQUIRED_DOC_TYPES).toHaveLength(4);
  });

  it('reports everything missing for a deal with no documents', () => {
    const result = checker.completeness('DEAL-1', []);
    expect(result.isComplete).toBe(false);
    expect(result.missing).toEqual(REQUIRED_DOC_TYPES);
    expect(result.bankRequiredMissing).toEqual(REQUIRED_DOC_TYPES);
    expect(result.releaseRequiredMissing).toEqual(REQUIRED_DOC_TYPES);
    expect(result.completionRate).toBe(0);
  });

  it('counts only SIGNED / GENERATED / UPLOADED statuses as present', () => {
    const result = checker.completeness('DEAL-1', [
      doc('contract', 'SIGNED'),
      doc('transport_waybill', 'GENERATED'),
      doc('quality_certificate', 'UPLOADED'),
      doc('acceptance_act', 'DRAFT'), // not a present-status → still missing
    ]);
    expect(result.missing).toEqual(['acceptance_act']);
    expect(result.isComplete).toBe(false);
    expect(result.completionRate).toBe(75);
  });

  it('is complete when all required types are present', () => {
    const result = checker.completeness('DEAL-1', [
      doc('contract', 'SIGNED'),
      doc('transport_waybill', 'SIGNED'),
      doc('quality_certificate', 'GENERATED'),
      doc('acceptance_act', 'UPLOADED'),
      doc('extra_unrequired', 'SIGNED'), // ignored — not a required type
    ]);
    expect(result.missing).toEqual([]);
    expect(result.isComplete).toBe(true);
    expect(result.completionRate).toBe(100);
  });

  it('rounds the completion rate (2 of 4 present → 50)', () => {
    const result = checker.completeness('DEAL-1', [
      doc('contract', 'SIGNED'),
      doc('quality_certificate', 'SIGNED'),
    ]);
    expect(result.completionRate).toBe(50);
    expect(result.missing).toEqual(['transport_waybill', 'acceptance_act']);
  });
});
