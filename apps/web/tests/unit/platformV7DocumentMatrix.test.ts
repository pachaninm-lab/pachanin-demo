import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_STANDARD_DOCUMENTS,
  getMoneyBlockingDocuments,
  isBankBasisReady,
  isDocumentReadyForStage,
  normalizeDocumentOwnerRole,
  platformV7CreateDocumentMatrix,
  platformV7DocumentMatrixReadiness,
  platformV7DocumentsBlockingStage,
  type DocumentConditionalContext,
  type PlatformV7DocumentRequirement,
  type PlatformV7DocumentRole,
  type PlatformV7DocumentStatus,
} from '@/lib/platform-v7/document-matrix';
import { PLATFORM_V7_CANONICAL_ROLES, type PlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';

type DocumentRoleMatchesCanonical = [PlatformV7DocumentRole] extends [PlatformV7CanonicalRole]
  ? [PlatformV7CanonicalRole] extends [PlatformV7DocumentRole]
    ? true
    : never
  : never;

const documentRoleMatchesCanonical: DocumentRoleMatchesCanonical = true;

const requiredDocumentIds = [
  'contract',
  'specification',
  'sdiz',
  'epd_transport_document',
  'acceptance_act',
  'lab_protocol',
  'discrepancy_act',
  'arbitration_decision',
  'bank_basis',
] as const;

const resolvedNoDiscrepancyContext: DocumentConditionalContext = {
  disputeStatus: 'resolved',
  hasWeightDiscrepancy: false,
  hasQualityDiscrepancy: false,
  arbitrationDecisionHasBankEffect: false,
};

function withStatuses(statuses: Partial<Record<string, PlatformV7DocumentStatus>>): readonly PlatformV7DocumentRequirement[] {
  return PLATFORM_V7_STANDARD_DOCUMENTS.map((document) => ({
    ...document,
    status: statuses[document.documentId] ?? 'confirmed',
  }));
}

function matrixWith(statuses: Partial<Record<string, PlatformV7DocumentStatus>>) {
  return platformV7CreateDocumentMatrix('deal-1', withStatuses(statuses));
}

function stageBlockerIds(stage: Parameters<typeof platformV7DocumentsBlockingStage>[1]) {
  return platformV7DocumentsBlockingStage(platformV7CreateDocumentMatrix('deal-1'), stage)
    .map((document) => document.documentId);
}

describe('platform-v7 document matrix', () => {
  it('generates all required document ids in the canonical order', () => {
    const matrix = platformV7CreateDocumentMatrix('deal-1');

    expect(matrix.documents.map((document) => document.documentId)).toEqual(requiredDocumentIds);
    expect(matrix.documents).toHaveLength(9);
    expect(matrix.documents.every((document) => document.dealId === 'deal-1')).toBe(true);
    expect(matrix.documents.every((document) => document.type === document.documentId)).toBe(true);
  });

  it('stores canonical owner roles without short aliases', () => {
    const matrix = platformV7CreateDocumentMatrix('deal-1');
    const ownerRoles = matrix.documents.map((document) => document.ownerRole);
    const forbiddenShortAliases = new Set(['logistics', 'elevator', 'lab', 'bank', 'executive', 'compliance']);

    expect(ownerRoles.every((role) => PLATFORM_V7_CANONICAL_ROLES.includes(role))).toBe(true);
    expect(ownerRoles.some((role) => forbiddenShortAliases.has(role))).toBe(false);
    expect(matrix.documents.find((document) => document.documentId === 'epd_transport_document')?.ownerRole).toBe('logistics_manager');
    expect(matrix.documents.find((document) => document.documentId === 'acceptance_act')?.ownerRole).toBe('elevator_operator');
    expect(matrix.documents.find((document) => document.documentId === 'discrepancy_act')?.ownerRole).toBe('elevator_operator');
    expect(matrix.documents.find((document) => document.documentId === 'lab_protocol')?.ownerRole).toBe('lab_specialist');
    expect(matrix.documents.every((document) => document.ownerRole === document.responsibleRole)).toBe(true);
  });

  it('maps required document blockers to deal stages', () => {
    expect(stageBlockerIds('deal_creation')).toContain('contract');
    expect(stageBlockerIds('release')).toEqual(expect.arrayContaining([
      'contract',
      'specification',
      'sdiz',
      'epd_transport_document',
      'acceptance_act',
      'lab_protocol',
      'bank_basis',
    ]));
    expect(stageBlockerIds('shipment')).toEqual(expect.arrayContaining(['specification', 'sdiz']));
    expect(stageBlockerIds('acceptance')).toContain('epd_transport_document');
    expect(stageBlockerIds('dispute')).toContain('lab_protocol');
  });

  it.each([
    'rejected',
    'expired',
    'manual_review',
    'draft',
    'uploaded',
    'sent',
  ] as const)('blocks release for %s documents', (status) => {
    const document = { ...PLATFORM_V7_STANDARD_DOCUMENTS[0]!, status };

    expect(isDocumentReadyForStage(document, 'release')).toBe(false);
  });

  it.each(['confirmed', 'signed'] as const)('passes release for %s documents', (status) => {
    const document = { ...PLATFORM_V7_STANDARD_DOCUMENTS[0]!, status };

    expect(isDocumentReadyForStage(document, 'release')).toBe(true);
  });

  it('uses stage-specific pass sets outside release', () => {
    const sentSdiz = { ...PLATFORM_V7_STANDARD_DOCUMENTS.find((document) => document.documentId === 'sdiz')!, status: 'sent' as const };
    const sentContract = { ...PLATFORM_V7_STANDARD_DOCUMENTS.find((document) => document.documentId === 'contract')!, status: 'sent' as const };
    const conditionalLab = { ...PLATFORM_V7_STANDARD_DOCUMENTS.find((document) => document.documentId === 'lab_protocol')!, status: 'conditional' as const };

    expect(isDocumentReadyForStage(sentSdiz, 'shipment')).toBe(true);
    expect(isDocumentReadyForStage(sentContract, 'deal_creation')).toBe(false);
    expect(isDocumentReadyForStage(conditionalLab, 'dispute')).toBe(true);
  });

  it('keeps conditional release documents blocking when context is absent', () => {
    const matrix = matrixWith({
      discrepancy_act: 'conditional',
      arbitration_decision: 'conditional',
      bank_basis: 'confirmed',
    });

    expect(isDocumentReadyForStage(matrix.documents.find((document) => document.documentId === 'discrepancy_act')!, 'release')).toBe(false);
    expect(isDocumentReadyForStage(matrix.documents.find((document) => document.documentId === 'arbitration_decision')!, 'release')).toBe(false);
    expect(platformV7DocumentMatrixReadiness(matrix)).toMatchObject({
      releaseReady: false,
      moneyBlockingCount: 2,
    });
  });

  it('evaluates discrepancy_act with conditional context', () => {
    const discrepancyAct = PLATFORM_V7_STANDARD_DOCUMENTS.find((document) => document.documentId === 'discrepancy_act')!;

    expect(isDocumentReadyForStage(discrepancyAct, 'release', {
      disputeStatus: 'none',
      hasWeightDiscrepancy: false,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: false,
    })).toBe(true);
    expect(isDocumentReadyForStage(discrepancyAct, 'release', {
      disputeStatus: 'resolved',
      hasWeightDiscrepancy: true,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: false,
    })).toBe(true);
    expect(isDocumentReadyForStage(discrepancyAct, 'release', {
      disputeStatus: 'open',
      hasWeightDiscrepancy: true,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: false,
    })).toBe(false);
    expect(isDocumentReadyForStage(discrepancyAct, 'release', {
      disputeStatus: 'none',
      hasWeightDiscrepancy: true,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: false,
    })).toBe(false);
  });

  it('does not let discrepancy_act alone unlock release when other release blockers remain', () => {
    const matrix = matrixWith({
      contract: 'missing',
      discrepancy_act: 'conditional',
      arbitration_decision: 'confirmed',
      bank_basis: 'confirmed',
    });

    expect(platformV7DocumentMatrixReadiness(matrix, resolvedNoDiscrepancyContext)).toMatchObject({
      releaseReady: false,
      moneyBlockingCount: 1,
    });
  });

  it('evaluates arbitration_decision without changing bank release semantics', () => {
    const arbitrationDecision = PLATFORM_V7_STANDARD_DOCUMENTS.find((document) => document.documentId === 'arbitration_decision')!;

    expect(isDocumentReadyForStage(arbitrationDecision, 'release', {
      disputeStatus: 'none',
      hasWeightDiscrepancy: false,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: false,
    })).toBe(true);
    expect(isDocumentReadyForStage(arbitrationDecision, 'release', {
      disputeStatus: 'decision_issued',
      hasWeightDiscrepancy: true,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: true,
    })).toBe(true);
    expect(isDocumentReadyForStage(arbitrationDecision, 'release', {
      disputeStatus: 'resolved',
      hasWeightDiscrepancy: true,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: true,
    })).toBe(true);
    expect(isDocumentReadyForStage(arbitrationDecision, 'release', {
      disputeStatus: 'open',
      hasWeightDiscrepancy: true,
      hasQualityDiscrepancy: false,
      arbitrationDecisionHasBankEffect: true,
    })).toBe(false);
  });

  it('returns money blockers only for affectsMoney documents that block release', () => {
    const nonMoneyDocument: PlatformV7DocumentRequirement = {
      ...PLATFORM_V7_STANDARD_DOCUMENTS[0]!,
      documentId: 'non_money_note',
      type: 'non_money_note',
      affectsMoney: false,
      status: 'missing',
    };
    const matrix = platformV7CreateDocumentMatrix('deal-1', [
      ...withStatuses({ bank_basis: 'confirmed' }),
      nonMoneyDocument,
    ]);

    expect(getMoneyBlockingDocuments(matrix, resolvedNoDiscrepancyContext).map((document) => document.documentId)).not.toContain('non_money_note');
    expect(getMoneyBlockingDocuments(matrixWith({ sdiz: 'missing' }), resolvedNoDiscrepancyContext).map((document) => document.documentId)).toContain('sdiz');
    expect(getMoneyBlockingDocuments(matrixWith({
      discrepancy_act: 'conditional',
      arbitration_decision: 'conditional',
      bank_basis: 'confirmed',
    }), resolvedNoDiscrepancyContext)).toEqual([]);
  });

  it('checks bank basis prerequisites without treating bank_basis as bank confirmation', () => {
    const readyPrerequisites = matrixWith({
      discrepancy_act: 'conditional',
      arbitration_decision: 'conditional',
      bank_basis: 'missing',
    });

    expect(isBankBasisReady(readyPrerequisites, {
      releaseGateAllowed: false,
      disputeResolved: true,
      conditionalContext: resolvedNoDiscrepancyContext,
    })).toBe(false);
    expect(isBankBasisReady(readyPrerequisites, {
      releaseGateAllowed: true,
      disputeResolved: false,
      conditionalContext: resolvedNoDiscrepancyContext,
    })).toBe(false);
    expect(isBankBasisReady(matrixWith({ sdiz: 'missing', bank_basis: 'missing' }), {
      releaseGateAllowed: true,
      disputeResolved: true,
      conditionalContext: resolvedNoDiscrepancyContext,
    })).toBe(false);
    expect(isBankBasisReady(readyPrerequisites, {
      releaseGateAllowed: true,
      disputeResolved: true,
      conditionalContext: resolvedNoDiscrepancyContext,
    })).toBe(true);
    expect(['missing', 'draft', 'uploaded', 'signed', 'sent', 'confirmed', 'rejected', 'expired', 'manual_review', 'conditional']).not.toContain('sent_to_bank');
  });

  it('normalizes legacy owner role aliases at the boundary', () => {
    expect(documentRoleMatchesCanonical).toBe(true);
    expect(normalizeDocumentOwnerRole('bank')).toBe('bank_officer');
    expect(normalizeDocumentOwnerRole('logistics')).toBe('logistics_manager');
    expect(normalizeDocumentOwnerRole('elevator')).toBe('elevator_operator');
    expect(normalizeDocumentOwnerRole('lab')).toBe('lab_specialist');
    expect(normalizeDocumentOwnerRole('compliance')).toBe('compliance_officer');
    expect(normalizeDocumentOwnerRole('unknown_role')).toBeNull();
  });

  it('stores canonical standard roles directly without using the boundary mapper', () => {
    const source = readFileSync(join(process.cwd(), 'lib/platform-v7/document-matrix.ts'), 'utf8');
    const standardsBlock = source.slice(
      source.indexOf('export const PLATFORM_V7_STANDARD_DOCUMENTS'),
      source.indexOf('export function normalizeDocumentOwnerRole'),
    );

    expect(standardsBlock).not.toContain('normalizeDocumentOwnerRole');
    expect(standardsBlock).not.toContain('toPlatformV7CanonicalRole');
  });

  it('keeps document output strings away from fake integration claims', () => {
    const forbidden = [
      'production-ready',
      'fully live',
      'fully integrated',
      'платформа гарантирует',
      'платформа сама выпускает',
    ];
    const output = PLATFORM_V7_STANDARD_DOCUMENTS
      .flatMap((document) => [document.title, document.nextAction])
      .join('\n')
      .toLowerCase();

    for (const phrase of forbidden) {
      expect(output).not.toContain(phrase);
    }
  });
});
