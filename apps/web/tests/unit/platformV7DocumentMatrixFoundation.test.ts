import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_STANDARD_DOCUMENTS,
  platformV7CreateDocumentMatrix,
  platformV7DocumentMatrixReadiness,
  platformV7DocumentsBlockingStage,
} from '@/lib/platform-v7/document-matrix';

describe('platform-v7 document matrix foundation', () => {
  it('contains the required money-impacting documents', () => {
    expect(PLATFORM_V7_STANDARD_DOCUMENTS.map((document) => document.documentId)).toEqual([
      'contract',
      'specification',
      'sdiz',
      'epd',
      'acceptance_act',
      'lab_protocol',
      'discrepancy_act',
      'arbitration_decision',
      'bank_basis',
    ]);
  });

  it('keeps every document actionable', () => {
    for (const document of PLATFORM_V7_STANDARD_DOCUMENTS) {
      expect(document.title).toBeTruthy();
      expect(document.responsibleRole).toBeTruthy();
      expect(document.status).toBeTruthy();
      expect(document.blockStages.length).toBeGreaterThan(0);
      expect(document.source).toBeTruthy();
      expect(document.nextAction).toBeTruthy();
    }
  });

  it('blocks release while required documents are missing', () => {
    const matrix = platformV7CreateDocumentMatrix('deal-1');
    const readiness = platformV7DocumentMatrixReadiness(matrix);

    expect(readiness.releaseReady).toBe(false);
    expect(readiness.moneyBlockingCount).toBeGreaterThan(0);
    expect(readiness.missingForRelease.map((document) => document.documentId)).toContain('sdiz');
    expect(readiness.missingForRelease.map((document) => document.documentId)).toContain('bank_basis');
  });

  it('marks release ready only when release blockers are confirmed or conditional', () => {
    const matrix = platformV7CreateDocumentMatrix('deal-1', PLATFORM_V7_STANDARD_DOCUMENTS.map((document) => ({
      ...document,
      status: document.status === 'conditional' ? 'conditional' : 'confirmed',
    })));

    expect(platformV7DocumentMatrixReadiness(matrix)).toEqual(expect.objectContaining({
      releaseReady: true,
      moneyBlockingCount: 0,
    }));
  });

  it('finds stage blockers without treating conditional documents as blockers', () => {
    const matrix = platformV7CreateDocumentMatrix('deal-1');
    const releaseBlockers = platformV7DocumentsBlockingStage(matrix, 'release');

    expect(releaseBlockers.map((document) => document.documentId)).toContain('sdiz');
    expect(releaseBlockers.map((document) => document.documentId)).not.toContain('discrepancy_act');
    expect(releaseBlockers.map((document) => document.documentId)).not.toContain('arbitration_decision');
  });
});
