import { describe, expect, it } from 'vitest';
import { documentBlockers, isDocumentRequirementSatisfied, summarizeDocuments } from '@/lib/platform-v7/grain-execution/automation/document-requirement-engine';
import type { DocumentRequirement } from '@/lib/platform-v7/grain-execution/types';

const baseDocument: DocumentRequirement = {
  id: 'DOC-DL-1-sdiz_realization',
  dealId: 'DL-1',
  relatedEntityType: 'batch',
  relatedEntityId: 'BATCH-1',
  documentType: 'sdiz_realization',
  required: true,
  status: 'uploaded',
  responsibleRole: 'seller',
  blocksLotPublication: true,
  blocksShipment: true,
  blocksAcceptance: false,
  blocksMoneyRelease: true,
  fileId: 'FILE-1',
  externalSystem: 'fgis',
  externalStatus: 'требует боевого подключения',
  createdAt: '2026-05-05T09:00:00.000Z',
  updatedAt: '2026-05-05T09:00:00.000Z',
};

function document(overrides: Partial<DocumentRequirement>): DocumentRequirement {
  return { ...baseDocument, ...overrides };
}

describe('platform-v7 document external confirmation safety', () => {
  it('does not treat uploaded external documents as satisfied', () => {
    const uploadedSdiz = document({ status: 'uploaded', externalSystem: 'fgis', externalStatus: 'требует боевого подключения' });

    expect(isDocumentRequirementSatisfied(uploadedSdiz)).toBe(false);
    expect(documentBlockers([uploadedSdiz])[0]?.description).toContain('Загрузка файла не является внешним подтверждением');
  });

  it('requires signed document and confirmed external status for external systems', () => {
    const signedWithoutExternalConfirmation = document({ status: 'signed', externalSystem: 'gis_epd', externalStatus: 'ожидает ответа' });
    const signedWithExternalConfirmation = document({ status: 'signed', externalSystem: 'bank', externalStatus: 'confirmed by bank event' });

    expect(isDocumentRequirementSatisfied(signedWithoutExternalConfirmation)).toBe(false);
    expect(isDocumentRequirementSatisfied(signedWithExternalConfirmation)).toBe(true);
  });

  it('keeps manual uploaded documents satisfied without external confirmation', () => {
    const uploadedManual = document({
      id: 'DOC-DL-1-contract',
      relatedEntityType: 'deal',
      documentType: 'contract',
      status: 'uploaded',
      externalSystem: 'manual',
      externalStatus: undefined,
    });

    expect(isDocumentRequirementSatisfied(uploadedManual)).toBe(true);
  });

  it('summarizes external documents as missing until external confirmation exists', () => {
    const uploadedSdiz = document({ status: 'uploaded', externalSystem: 'fgis', externalStatus: 'требует боевого подключения' });
    const manualContract = document({ id: 'DOC-DL-1-contract', relatedEntityType: 'deal', documentType: 'contract', status: 'uploaded', externalSystem: 'manual', externalStatus: undefined });
    const confirmedBank = document({ id: 'DOC-DL-1-bank', documentType: 'bank_confirmation', status: 'signed', externalSystem: 'bank', externalStatus: 'confirmed' });

    expect(summarizeDocuments([uploadedSdiz, manualContract, confirmedBank])).toEqual({
      total: 3,
      ready: 2,
      missing: 1,
      blockingMoneyRelease: 1,
    });
  });
});
