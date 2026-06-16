import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_STANDARD_DOCUMENTS } from '@/lib/platform-v7/document-matrix';

const allowedSourcesByDocument = new Map([
  ['contract', 'edo'],
  ['specification', 'edo'],
  ['sdiz', 'fgis'],
  ['epd_transport_document', 'epd'],
  ['acceptance_act', 'elevator'],
  ['lab_protocol', 'lab'],
  ['discrepancy_act', 'elevator'],
  ['arbitration_decision', 'arbitration'],
  ['bank_basis', 'bank'],
]);

describe('platform-v7 document logic audit', () => {
  it('keeps every standard document connected to stage, owner, source, money impact and next action', () => {
    const broken = PLATFORM_V7_STANDARD_DOCUMENTS.flatMap((document) => {
      const issues: string[] = [];
      if (!document.documentId) issues.push('missing id');
      if (!document.title) issues.push('missing title');
      if (!document.ownerRole || document.ownerRole !== document.responsibleRole) issues.push('owner/responsible mismatch');
      if (!document.source) issues.push('missing source');
      if (!document.nextAction) issues.push('missing next action');
      if (!document.blockStages.length) issues.push('missing blocking stage');
      if (document.affectsMoney && !document.blockStages.includes('release')) issues.push('money document does not block release');
      return issues.map((issue) => `${document.documentId}: ${issue}`);
    });

    expect(broken).toEqual([]);
  });

  it('keeps document sources aligned with document type', () => {
    const sourceMismatches = PLATFORM_V7_STANDARD_DOCUMENTS
      .filter((document) => allowedSourcesByDocument.get(document.documentId) !== document.source)
      .map((document) => `${document.documentId}: ${document.source}`);

    expect(sourceMismatches).toEqual([]);
  });

  it('keeps dispute-only conditional documents explicitly conditional, not silently confirmed', () => {
    const discrepancyAct = PLATFORM_V7_STANDARD_DOCUMENTS.find((document) => document.documentId === 'discrepancy_act');
    const arbitrationDecision = PLATFORM_V7_STANDARD_DOCUMENTS.find((document) => document.documentId === 'arbitration_decision');

    expect(discrepancyAct?.status).toBe('conditional');
    expect(discrepancyAct?.blockStages).toEqual(expect.arrayContaining(['release', 'dispute']));
    expect(arbitrationDecision?.status).toBe('conditional');
    expect(arbitrationDecision?.blockStages).toContain('release');
  });
});
