import { describe, expect, it } from 'vitest';
import { runPlatformV7ExecutionEvidenceScenario } from '../../../../packages/domain-core/src/execution-simulation/scenario-runner';

describe('platform-v7 execution/evidence scenario runner', () => {
  it('runs one deterministic controlled-pilot path to close readiness', () => {
    const report = runPlatformV7ExecutionEvidenceScenario();

    expect(report.scenarioId).toBe('P7-E2E-2096');
    expect(report.finalStatus).toBe('CLOSED');
    expect(report.closeReady).toBe(true);
    expect(report.passedStepIds).toEqual([
      'createLot',
      'publishLot',
      'acceptOffer',
      'createDeal',
      'contractDrafted',
      'awaitingSignatures',
      'signed',
      'requestReserve',
      'confirmReserve',
      'assignDriver',
      'loadingConfirmed',
      'loaded',
      'inTransit',
      'arrived',
      'weighingConfirmed',
      'labSampling',
      'labProtocolCreated',
      'accepted',
      'documentsPending',
      'documentsReady',
      'requestCloseBasis',
      'confirmFinalBasis',
      'closeDeal',
    ]);
    expect(report.auditEventCountDelta).toBeGreaterThan(0);
    expect(report.timelineEventCountDelta).toBeGreaterThan(0);
  });

  it('keeps explicit blocker coverage before close', () => {
    const report = runPlatformV7ExecutionEvidenceScenario();

    expect(report.blockedChecks.every((check) => check.passed)).toBe(true);
    expect(report.blockedChecks.map((check) => check.actualCode)).toEqual(expect.arrayContaining([
      'NO_RELEASE_WITHOUT_RESERVE',
      'NO_RELEASE_WITHOUT_DOCUMENTS',
      'NO_FINAL_RELEASE_WITH_OPEN_DISPUTE',
      'NO_ACCEPTED_WITHOUT_WEIGHT',
      'NO_ACCEPTED_WITHOUT_LAB',
      'NO_BANK_COMMAND_WITHOUT_IDEMPOTENCY',
    ]));
  });
});
