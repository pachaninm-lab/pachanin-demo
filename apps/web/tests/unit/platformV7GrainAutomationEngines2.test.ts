import { existsSync, readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import {
  createActionFeedbackPreview,
  createActionFeedbackPreviewsForRole,
} from '@/lib/platform-v7/grain-execution/automation/action-feedback-engine';
import { guardNextActionsForExecutionState } from '@/lib/platform-v7/grain-execution/automation/action-guard-engine';
import {
  createAuditEvent,
  createRequiredAuditEvents,
} from '@/lib/platform-v7/grain-execution/automation/audit-event-engine';
import {
  calculateEvidencePackReadiness,
  evidencePackBlocker,
  canPrepareDisputeDecision,
  prepareDisputeDecision,
} from '@/lib/platform-v7/grain-execution/automation/evidence-pack-engine';
import {
  canSee,
  assertRoleVisibility,
  projectSummaryForRole,
} from '@/lib/platform-v7/grain-execution/automation/role-visibility-engine';
import {
  createSupportActionFeedback,
  createSupportActionFeedbackListForRole,
} from '@/lib/platform-v7/grain-execution/automation/support-action-feedback-engine';
import {
  createSupportCaseFromBlocker,
  createSupportCases,
  summarizeSupport,
} from '@/lib/platform-v7/grain-execution/automation/support-case-engine';
import type {
  NextAction,
  MoneyProjection,
  EvidencePack,
  Dispute,
  ExecutionBlocker,
  SupportCase,
  RoleExecutionSummary,
  BatchReadiness,
  DocumentRequirement,
  LogisticsOrder,
  SdizGate,
} from '@/lib/platform-v7/grain-execution/types';
import { money } from '@/lib/platform-v7/grain-execution/format';

const AUTOMATION_FILES_2 = [
  'lib/platform-v7/grain-execution/automation/action-feedback-engine.ts',
  'lib/platform-v7/grain-execution/automation/action-guard-engine.ts',
  'lib/platform-v7/grain-execution/automation/audit-event-engine.ts',
  'lib/platform-v7/grain-execution/automation/evidence-pack-engine.ts',
  'lib/platform-v7/grain-execution/automation/role-visibility-engine.ts',
  'lib/platform-v7/grain-execution/automation/support-action-feedback-engine.ts',
  'lib/platform-v7/grain-execution/automation/support-case-engine.ts',
];

// ─── fixture helpers ──────────────────────────────────────────────────────────

function makeAction(overrides?: Partial<NextAction>): NextAction {
  return {
    id: 'ACT-001',
    title: 'Публикация лота',
    role: 'seller',
    priority: 'medium',
    actionType: 'publish_lot',
    targetRoute: '/lots/publish',
    disabled: false,
    createsAuditEvent: true,
    requiresReason: false,
    ...overrides,
  };
}

function makeMoney(value: number) {
  return money(value);
}

function makeMoneyProjection(overrides?: Partial<MoneyProjection>): MoneyProjection {
  const base = makeMoney(0);
  return {
    dealId: 'DL-001',
    grossDealAmount: makeMoney(1_000_000),
    reservedAmount: makeMoney(1_000_000),
    readyToReleaseAmount: makeMoney(800_000),
    heldAmount: makeMoney(100_000),
    disputedAmount: base,
    manualReviewAmount: makeMoney(100_000),
    releasedAmount: base,
    adjustments: [],
    releaseAllowed: true,
    releaseBlockedReasons: [],
    ...overrides,
  };
}

function makeEvidencePack(overrides?: Partial<EvidencePack>): EvidencePack {
  return {
    id: 'EP-001',
    dealId: 'DL-001',
    documentIds: ['DOC-1'],
    weightEvidenceIds: ['WE-1'],
    photoIds: ['PH-1'],
    routeEventIds: ['RE-1'],
    labProtocolIds: ['LP-1'],
    sampleChainIds: ['SC-1'],
    supportMessageIds: [],
    decisionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDispute(overrides?: Partial<Dispute>): Dispute {
  return {
    id: 'DSP-001',
    dealId: 'DL-001',
    reason: 'quality',
    status: 'open',
    disputedAmount: makeMoney(50_000),
    undisputedAmount: makeMoney(950_000),
    openedByRole: 'buyer',
    openedByPartyId: 'B-001',
    evidencePackId: 'EP-001',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBlocker(overrides?: Partial<ExecutionBlocker>): ExecutionBlocker {
  return {
    id: 'BLK-001',
    type: 'document',
    severity: 'critical',
    title: 'Не загружен УПД',
    description: 'Документ обязателен для выпуска денег.',
    blocks: 'money_release',
    responsibleRole: 'seller',
    relatedEntityType: 'document_requirement',
    relatedEntityId: 'DR-001',
    ...overrides,
  };
}

function makeSupportCase(overrides?: Partial<SupportCase>): SupportCase {
  return {
    id: 'SUP-001',
    title: 'Блокер документа',
    description: 'Нужен УПД для закрытия сделки.',
    status: 'open',
    priority: 'high',
    category: 'documents',
    requesterRole: 'seller',
    relatedEntityType: 'document',
    relatedEntityId: 'DOC-001',
    dealId: 'DL-001',
    automationSource: 'system_gate',
    suggestedResolution: 'Загрузить УПД.',
    nextActionTitle: 'Загрузить документ',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRoleExecutionSummary(overrides?: Partial<RoleExecutionSummary>): RoleExecutionSummary {
  return {
    role: 'operator',
    entityType: 'deal',
    entityId: 'DL-001',
    currentState: 'execution',
    blockers: [],
    nextActions: [],
    maturity: 'controlled-pilot',
    moneySummary: makeMoneyProjection(),
    documentSummary: { total: 5, ready: 4, missing: 1, blockingMoneyRelease: 1 },
    logisticsSummary: { status: 'in_transit', currentStep: 'В пути', incidentCount: 0 },
    qualitySummary: { status: 'within_tolerance', totalDiscount: makeMoney(0), repeatAnalysisAvailable: false },
    sdizSummary: { total: 2, ready: 2, blockingShipment: 0, blockingMoneyRelease: 0 },
    supportSummary: { openCases: 0, criticalCases: 0 },
    ...overrides,
  };
}

// ─── source guard ─────────────────────────────────────────────────────────────

describe('PR 15.0 — source guard', () => {
  for (const file of AUTOMATION_FILES_2) {
    it(`${file} exists`, () => {
      expect(existsSync(file)).toBe(true);
    });

    it(`${file} has no live network calls`, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/https?:\/\//);
    });
  }
});

// ─── action-feedback-engine ───────────────────────────────────────────────────

describe('createActionFeedbackPreview', () => {
  it('returns "Действие принято в работу" for enabled action', () => {
    const preview = createActionFeedbackPreview(makeAction({ actionType: 'publish_lot' }));
    expect(preview.title).toBe('Действие принято в работу');
    expect(preview.actionId).toBe('ACT-001');
  });

  it('returns "Действие пока закрыто" for disabled action', () => {
    const preview = createActionFeedbackPreview(
      makeAction({ disabled: true, disabledReason: 'нет готовности' }),
    );
    expect(preview.title).toBe('Действие пока закрыто');
    expect(preview.statusText).toBe('нет готовности');
  });

  it('blocks approve_release when money amounts mismatch', () => {
    const moneyProjection = makeMoneyProjection({
      readyToReleaseAmount: makeMoney(500_000),
    });
    const preview = createActionFeedbackPreview(
      makeAction({ actionType: 'approve_release' }),
      moneyProjection,
    );
    expect(preview.title).toBe('Действие пока закрыто');
    expect(preview.statusText).toContain('суммы резерва');
  });

  it('blocks approve_release when money blocker reasons exist', () => {
    const moneyProjection = makeMoneyProjection({
      releaseBlockedReasons: [makeBlocker()],
    });
    const preview = createActionFeedbackPreview(
      makeAction({ actionType: 'approve_release' }),
      moneyProjection,
    );
    expect(preview.statusText).toContain('незакрытые документы');
  });

  it('returns bank external confirmation text for approve_release', () => {
    const preview = createActionFeedbackPreview(makeAction({ actionType: 'approve_release' }));
    expect(preview.externalConfirmationText).toContain('банковое');
  });

  it('returns generic external confirmation text for non-money actions', () => {
    const preview = createActionFeedbackPreview(makeAction({ actionType: 'publish_lot' }));
    expect(preview.externalConfirmationText).toContain('Внешнее подтверждение не имитируется');
  });
});

describe('createActionFeedbackPreviewsForRole', () => {
  it('returns previews for visible role actions only', () => {
    const actions = [
      makeAction({ id: 'A1', role: 'seller', actionType: 'publish_lot' }),
      makeAction({ id: 'A2', role: 'bank', actionType: 'approve_release' }),
    ];
    const result = createActionFeedbackPreviewsForRole(actions, 'seller');
    expect(result.map((p) => p.actionId)).toContain('A1');
  });

  it('investor sees no action feedback', () => {
    const actions = [makeAction({ actionType: 'publish_lot' })];
    const result = createActionFeedbackPreviewsForRole(actions, 'investor');
    expect(result).toHaveLength(0);
  });

  it('operator sees all action feedbacks', () => {
    const actions = [
      makeAction({ id: 'A1', role: 'seller', actionType: 'publish_lot' }),
      makeAction({ id: 'A2', role: 'bank', actionType: 'approve_release' }),
      makeAction({ id: 'A3', role: 'driver', actionType: 'capture_weight' }),
    ];
    const result = createActionFeedbackPreviewsForRole(actions, 'operator');
    expect(result).toHaveLength(3);
  });

  it('bank sees reserve_money and approve_release actions', () => {
    const actions = [
      makeAction({ id: 'A1', role: 'seller', actionType: 'publish_lot' }),
      makeAction({ id: 'A2', role: 'seller', actionType: 'reserve_money' }),
      makeAction({ id: 'A3', role: 'bank', actionType: 'approve_release' }),
    ];
    const result = createActionFeedbackPreviewsForRole(actions, 'bank');
    expect(result.map((p) => p.actionId)).toContain('A2');
    expect(result.map((p) => p.actionId)).toContain('A3');
  });
});

// ─── action-guard-engine ──────────────────────────────────────────────────────

describe('guardNextActionsForExecutionState', () => {
  it('returns actions unchanged when no guard conditions apply', () => {
    const actions = [makeAction({ actionType: 'create_batch' })];
    const result = guardNextActionsForExecutionState(actions, {});
    expect(result[0].disabled).toBeFalsy();
  });

  it('disables publish_lot when batch readiness is blocked', () => {
    const readiness: BatchReadiness = {
      batchId: 'GB-001',
      score: 40,
      status: 'blocked',
      blockers: [],
      nextActions: [],
    };
    const result = guardNextActionsForExecutionState(
      [makeAction({ actionType: 'publish_lot' })],
      { readiness },
    );
    expect(result[0].disabled).toBe(true);
    expect(result[0].disabledReason).toContain('заблокирована');
  });

  it('disables publish_lot when readiness score < 80', () => {
    const readiness: BatchReadiness = {
      batchId: 'GB-001',
      score: 70,
      status: 'almost_ready',
      blockers: [],
      nextActions: [],
    };
    const result = guardNextActionsForExecutionState(
      [makeAction({ actionType: 'publish_lot' })],
      { readiness },
    );
    expect(result[0].disabled).toBe(true);
    expect(result[0].disabledReason).toContain('порог');
  });

  it('allows publish_lot when readiness score >= 80', () => {
    const readiness: BatchReadiness = {
      batchId: 'GB-001',
      score: 85,
      status: 'ready_for_sale',
      blockers: [],
      nextActions: [],
    };
    const result = guardNextActionsForExecutionState(
      [makeAction({ actionType: 'publish_lot' })],
      { readiness },
    );
    expect(result[0].disabled).toBeFalsy();
  });

  it('disables assign_logistics when no money reservation', () => {
    const moneyProjection = makeMoneyProjection({ reservedAmount: makeMoney(0) });
    const result = guardNextActionsForExecutionState(
      [makeAction({ actionType: 'assign_logistics' })],
      { moneyProjection },
    );
    expect(result[0].disabled).toBe(true);
    expect(result[0].disabledReason).toContain('денежной готовности');
  });

  it('disables approve_release when release is not allowed', () => {
    const moneyProjection = makeMoneyProjection({ releaseAllowed: false });
    const result = guardNextActionsForExecutionState(
      [makeAction({ actionType: 'approve_release' })],
      { moneyProjection },
    );
    expect(result[0].disabled).toBe(true);
  });

  it('disables capture_weight when logistics order not arrived', () => {
    const logisticsOrder = { status: 'in_transit' } as LogisticsOrder;
    const result = guardNextActionsForExecutionState(
      [makeAction({ actionType: 'capture_weight' })],
      { logisticsOrder },
    );
    expect(result[0].disabled).toBe(true);
    expect(result[0].disabledReason).toContain('прибытия');
  });

  it('preserves existing disabledReason if action already disabled', () => {
    const action = makeAction({ disabled: true, disabledReason: 'оригинал', actionType: 'create_batch' });
    const result = guardNextActionsForExecutionState([action], {});
    expect(result[0].disabledReason).toBe('оригинал');
  });
});

// ─── audit-event-engine ───────────────────────────────────────────────────────

describe('createAuditEvent', () => {
  it('returns event with correct fields', () => {
    const event = createAuditEvent({
      entityType: 'deal',
      entityId: 'DL-001',
      actorRole: 'operator',
      action: 'deal_created',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(event.entityType).toBe('deal');
    expect(event.entityId).toBe('DL-001');
    expect(event.actorRole).toBe('operator');
    expect(event.action).toBe('deal_created');
    expect(event.id).toMatch(/^AUD-/);
  });

  it('includes optional dealId and reason when provided', () => {
    const event = createAuditEvent({
      entityType: 'money',
      entityId: 'DL-001',
      dealId: 'DL-001',
      actorRole: 'bank',
      action: 'reserve_confirmed',
      reason: 'sandbox test',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(event.dealId).toBe('DL-001');
    expect(event.reason).toBe('sandbox test');
  });

  it('IDs increment across calls', () => {
    const e1 = createAuditEvent({ entityType: 'test', entityId: 'X', actorRole: 'operator', action: 'a', createdAt: '2026-01-01T00:00:00.000Z' });
    const e2 = createAuditEvent({ entityType: 'test', entityId: 'X', actorRole: 'operator', action: 'b', createdAt: '2026-01-01T00:00:00.000Z' });
    const n1 = Number.parseInt(e1.id.replace('AUD-', ''), 10);
    const n2 = Number.parseInt(e2.id.replace('AUD-', ''), 10);
    expect(n2).toBe(n1 + 1);
  });
});

describe('createRequiredAuditEvents', () => {
  it('returns 15 canonical audit events', () => {
    const events = createRequiredAuditEvents('2026-01-01T00:00:00.000Z');
    expect(events).toHaveLength(15);
  });

  it('all events have valid entityType and action', () => {
    const events = createRequiredAuditEvents('2026-01-01T00:00:00.000Z');
    for (const event of events) {
      expect(event.entityType).toBeTruthy();
      expect(event.action).toBeTruthy();
    }
  });

  it('passes createdAt to all events', () => {
    const ts = '2026-06-08T00:00:00.000Z';
    const events = createRequiredAuditEvents(ts);
    for (const event of events) {
      expect(event.createdAt).toBe(ts);
    }
  });
});

// ─── evidence-pack-engine ─────────────────────────────────────────────────────

describe('calculateEvidencePackReadiness', () => {
  it('returns ready=true when all 6 evidence types are present', () => {
    const result = calculateEvidencePackReadiness(makeEvidencePack());
    expect(result.ready).toBe(true);
    expect(result.score).toBe(100);
    expect(result.missing).toHaveLength(0);
  });

  it('returns ready=false with correct missing keys', () => {
    const pack = makeEvidencePack({ photoIds: [], routeEventIds: [] });
    const result = calculateEvidencePackReadiness(pack);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('photos');
    expect(result.missing).toContain('route');
    expect(result.score).toBe(Math.round((4 / 6) * 100));
  });

  it('returns score 0 when all evidence is missing', () => {
    const pack = makeEvidencePack({
      documentIds: [],
      weightEvidenceIds: [],
      photoIds: [],
      routeEventIds: [],
      labProtocolIds: [],
      sampleChainIds: [],
    });
    const result = calculateEvidencePackReadiness(pack);
    expect(result.ready).toBe(false);
    expect(result.score).toBe(0);
    expect(result.missing).toHaveLength(6);
  });
});

describe('evidencePackBlocker', () => {
  it('returns null when pack is complete', () => {
    expect(evidencePackBlocker(makeEvidencePack())).toBeNull();
  });

  it('returns blocker when pack has missing evidence', () => {
    const blocker = evidencePackBlocker(makeEvidencePack({ photoIds: [] }));
    expect(blocker).not.toBeNull();
    expect(blocker?.blocks).toBe('deal_closing');
    expect(blocker?.severity).toBe('critical');
    expect(blocker?.description).toContain('фотофиксация');
  });
});

describe('canPrepareDisputeDecision', () => {
  it('returns true when pack is complete', () => {
    expect(canPrepareDisputeDecision(makeEvidencePack())).toBe(true);
  });

  it('returns false when evidence is missing', () => {
    expect(canPrepareDisputeDecision(makeEvidencePack({ labProtocolIds: [] }))).toBe(false);
  });
});

describe('prepareDisputeDecision', () => {
  it('creates dispute decision with complete evidence', () => {
    const decision = prepareDisputeDecision({
      dispute: makeDispute(),
      evidencePack: makeEvidencePack(),
      decision: 'partial_hold',
      reason: 'Качество ниже нормы',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(decision).not.toBeNull();
    expect(decision?.decision).toBe('partial_hold');
    expect(decision?.reason).toBe('Качество ниже нормы');
    expect(decision?.decidedByRole).toBe('operator');
  });

  it('returns null when evidence pack is incomplete', () => {
    const result = prepareDisputeDecision({
      dispute: makeDispute(),
      evidencePack: makeEvidencePack({ photoIds: [] }),
      decision: 'seller_fully_right',
      reason: 'Всё верно',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result).toBeNull();
  });

  it('defaults holdAmount to dispute amount when not provided', () => {
    const dispute = makeDispute({ disputedAmount: makeMoney(75_000) });
    const decision = prepareDisputeDecision({
      dispute,
      evidencePack: makeEvidencePack(),
      decision: 'partial_hold',
      reason: 'Частичное удержание',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(decision?.holdAmount.value).toBe(75_000);
  });
});

// ─── role-visibility-engine ───────────────────────────────────────────────────

describe('canSee', () => {
  it('seller can see batches and deals', () => {
    expect(canSee('seller', 'batches')).toBe(true);
    expect(canSee('seller', 'deals')).toBe(true);
  });

  it('driver can only see driver_field', () => {
    expect(canSee('driver', 'driver_field')).toBe(true);
    expect(canSee('driver', 'money')).toBe(false);
    expect(canSee('driver', 'deals')).toBe(false);
  });

  it('investor can only see investor area', () => {
    expect(canSee('investor', 'investor')).toBe(true);
    expect(canSee('investor', 'money')).toBe(false);
    expect(canSee('investor', 'deals')).toBe(false);
  });

  it('bank can see bank_release and money', () => {
    expect(canSee('bank', 'bank_release')).toBe(true);
    expect(canSee('bank', 'money')).toBe(true);
  });

  it('operator can see all areas', () => {
    const allAreas = ['batches', 'lots', 'rfq', 'offers', 'deals', 'money', 'documents', 'quality', 'weight', 'logistics', 'driver_field', 'elevator_terminal', 'lab_protocols', 'bank_release', 'support', 'disputes', 'internal_notes', 'closed_bids', 'commercial_margin', 'role_switcher'] as const;
    for (const area of allAreas) {
      expect(canSee('operator', area)).toBe(true);
    }
  });

  it('elevator cannot see commercial_margin', () => {
    expect(canSee('elevator', 'commercial_margin')).toBe(false);
  });
});

describe('assertRoleVisibility', () => {
  it('returns empty array when no leaks exist', () => {
    const summary = makeRoleExecutionSummary({ role: 'operator' });
    expect(assertRoleVisibility(summary)).toHaveLength(0);
  });

  it('detects money leak for driver', () => {
    const summary = makeRoleExecutionSummary({
      role: 'driver',
      moneySummary: makeMoneyProjection(),
    });
    const leaks = assertRoleVisibility(summary);
    expect(leaks.some((l) => l.includes('деньги'))).toBe(true);
  });

  it('detects money leak for logistics', () => {
    const summary = makeRoleExecutionSummary({
      role: 'logistics',
      moneySummary: makeMoneyProjection(),
    });
    const leaks = assertRoleVisibility(summary);
    expect(leaks.some((l) => l.includes('банковский резерв'))).toBe(true);
  });

  it('detects support leak for investor', () => {
    const summary = makeRoleExecutionSummary({
      role: 'investor',
      supportSummary: { openCases: 1, criticalCases: 0 },
    });
    const leaks = assertRoleVisibility(summary);
    expect(leaks.some((l) => l.includes('Инвестор'))).toBe(true);
  });
});

describe('projectSummaryForRole', () => {
  it('hides moneySummary from driver', () => {
    const summary = makeRoleExecutionSummary({ role: 'operator' });
    const projected = projectSummaryForRole(summary, 'driver');
    expect(projected.moneySummary).toBeUndefined();
  });

  it('hides logisticsSummary from investor', () => {
    const summary = makeRoleExecutionSummary({ role: 'operator' });
    const projected = projectSummaryForRole(summary, 'investor');
    expect(projected.logisticsSummary).toBeUndefined();
  });

  it('keeps moneySummary for bank', () => {
    const summary = makeRoleExecutionSummary({ role: 'operator' });
    const projected = projectSummaryForRole(summary, 'bank');
    expect(projected.moneySummary).toBeDefined();
  });

  it('hides documentSummary from investor', () => {
    const summary = makeRoleExecutionSummary({ role: 'operator' });
    const projected = projectSummaryForRole(summary, 'investor');
    expect(projected.documentSummary).toBeUndefined();
  });
});

// ─── support-action-feedback-engine ──────────────────────────────────────────

describe('createSupportActionFeedback', () => {
  it('returns feedback with correct supportCaseId', () => {
    const feedback = createSupportActionFeedback(makeSupportCase());
    expect(feedback.supportCaseId).toBe('SUP-001');
  });

  it('shows open status text for open case', () => {
    const feedback = createSupportActionFeedback(makeSupportCase({ status: 'open' }));
    expect(feedback.statusText).toContain('ожидает действия');
  });

  it('shows in-progress text for non-open case', () => {
    const feedback = createSupportActionFeedback(makeSupportCase({ status: 'in_progress' }));
    expect(feedback.statusText).toContain('обработке');
  });

  it('uses nextActionTitle as nextVisibleState', () => {
    const feedback = createSupportActionFeedback(
      makeSupportCase({ nextActionTitle: 'Загрузить документ' }),
    );
    expect(feedback.nextVisibleState).toBe('Загрузить документ');
  });

  it('falls back to suggestedResolution when no nextActionTitle', () => {
    const feedback = createSupportActionFeedback(
      makeSupportCase({ nextActionTitle: undefined, suggestedResolution: 'Проверить статус' }),
    );
    expect(feedback.nextVisibleState).toBe('Проверить статус');
  });
});

describe('createSupportActionFeedbackListForRole', () => {
  it('bank sees only money/documents/dispute support cases', () => {
    const cases = [
      makeSupportCase({ id: 'S1', category: 'money' }),
      makeSupportCase({ id: 'S2', category: 'quality' }),
      makeSupportCase({ id: 'S3', category: 'documents' }),
    ];
    const result = createSupportActionFeedbackListForRole(cases, 'bank');
    expect(result.map((f) => f.supportCaseId)).toContain('S1');
    expect(result.map((f) => f.supportCaseId)).toContain('S3');
    expect(result.map((f) => f.supportCaseId)).not.toContain('S2');
  });

  it('logistics sees only logistics support cases', () => {
    const cases = [
      makeSupportCase({ id: 'S1', category: 'logistics' }),
      makeSupportCase({ id: 'S2', category: 'money' }),
    ];
    const result = createSupportActionFeedbackListForRole(cases, 'logistics');
    expect(result.map((f) => f.supportCaseId)).toContain('S1');
    expect(result.map((f) => f.supportCaseId)).not.toContain('S2');
  });

  it('investor sees no support cases', () => {
    const cases = [makeSupportCase()];
    const result = createSupportActionFeedbackListForRole(cases, 'investor');
    expect(result).toHaveLength(0);
  });

  it('operator sees all support cases', () => {
    const cases = [
      makeSupportCase({ id: 'S1', category: 'money' }),
      makeSupportCase({ id: 'S2', category: 'quality' }),
      makeSupportCase({ id: 'S3', category: 'logistics' }),
    ];
    const result = createSupportActionFeedbackListForRole(cases, 'operator');
    expect(result).toHaveLength(3);
  });
});

// ─── support-case-engine ──────────────────────────────────────────────────────

describe('createSupportCaseFromBlocker', () => {
  it('creates a support case with correct title and category', () => {
    const blocker = makeBlocker({ type: 'document', title: 'Нет УПД', severity: 'critical' });
    const supportCase = createSupportCaseFromBlocker({
      blocker,
      dealId: 'DL-001',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(supportCase.title).toBe('Нет УПД');
    expect(supportCase.category).toBe('documents');
    expect(supportCase.priority).toBe('critical');
    expect(supportCase.status).toBe('open');
  });

  it('maps blocker type to correct category', () => {
    const types: Array<[ExecutionBlocker['type'], SupportCase['category']]> = [
      ['fgis', 'fgis'],
      ['sdiz', 'sdiz'],
      ['money', 'money'],
      ['quality', 'quality'],
      ['weight', 'weight'],
      ['logistics', 'logistics'],
      ['dispute', 'dispute'],
      ['manual', 'other'],
    ];
    for (const [type, expectedCategory] of types) {
      const sc = createSupportCaseFromBlocker({
        blocker: makeBlocker({ type }),
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(sc.category).toBe(expectedCategory);
    }
  });

  it('sets priority high for warning severity', () => {
    const blocker = makeBlocker({ severity: 'warning' });
    const sc = createSupportCaseFromBlocker({
      blocker,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(sc.priority).toBe('high');
  });
});

describe('createSupportCases', () => {
  it('excludes info-severity blockers', () => {
    const blockers = [
      makeBlocker({ id: 'BLK-A', severity: 'info' }),
      makeBlocker({ id: 'BLK-B', severity: 'critical' }),
    ];
    const cases = createSupportCases({ blockers, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(cases.map((c) => c.id)).not.toContain('SUP-BLK-A');
    expect(cases.map((c) => c.id)).toContain('SUP-BLK-B');
  });

  it('creates case from open logistics incident', () => {
    const incidents = [
      {
        id: 'INC-001',
        dealId: 'DL-001',
        logisticsOrderId: 'LOG-001',
        type: 'vehicle_late' as const,
        severity: 'warning' as const,
        title: 'Машина опаздывает',
        status: 'open' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const cases = createSupportCases({ blockers: [], incidents, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(cases.some((c) => c.category === 'logistics')).toBe(true);
  });

  it('skips resolved incidents', () => {
    const incidents = [
      {
        id: 'INC-R',
        dealId: 'DL-001',
        logisticsOrderId: 'LOG-001',
        type: 'vehicle_late' as const,
        severity: 'warning' as const,
        title: 'Закрытый инцидент',
        status: 'resolved' as const,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const cases = createSupportCases({ blockers: [], incidents, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(cases).toHaveLength(0);
  });

  it('creates quality case for discount_required status', () => {
    const qualityDelta = {
      id: 'QD-001',
      dealId: 'DL-001',
      batchId: 'GB-001',
      agreedQualityProfileId: 'QP-001',
      items: [],
      totalDiscount: makeMoney(5_000),
      totalHoldAmount: makeMoney(5_000),
      status: 'discount_required' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const cases = createSupportCases({ blockers: [], qualityDelta, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(cases.some((c) => c.category === 'quality')).toBe(true);
  });

  it('creates weight case for deviation status', () => {
    const weightBalance = {
      id: 'WB-001',
      dealId: 'DL-001',
      batchId: 'GB-001',
      contractedVolumeTons: 500,
      weightDeviationMoneyImpact: makeMoney(10_000),
      status: 'deviation' as const,
      evidenceIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const cases = createSupportCases({ blockers: [], weightBalance, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(cases.some((c) => c.category === 'weight')).toBe(true);
  });
});

describe('summarizeSupport', () => {
  it('counts open and critical cases correctly', () => {
    const cases: SupportCase[] = [
      makeSupportCase({ id: 'S1', status: 'open', priority: 'critical' }),
      makeSupportCase({ id: 'S2', status: 'in_progress', priority: 'high' }),
      makeSupportCase({ id: 'S3', status: 'resolved', priority: 'critical' }),
    ];
    const summary = summarizeSupport(cases);
    expect(summary.openCases).toBe(2);
    expect(summary.criticalCases).toBe(1);
  });

  it('returns nextActionTitle from first case with one', () => {
    const cases = [
      makeSupportCase({ id: 'S1', nextActionTitle: undefined }),
      makeSupportCase({ id: 'S2', nextActionTitle: 'Загрузить документ' }),
    ];
    const summary = summarizeSupport(cases);
    expect(summary.nextActionTitle).toBe('Загрузить документ');
  });

  it('returns zero counts for empty list', () => {
    const summary = summarizeSupport([]);
    expect(summary.openCases).toBe(0);
    expect(summary.criticalCases).toBe(0);
  });
});
