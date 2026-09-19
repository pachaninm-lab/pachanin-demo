import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

const SOT_FILES = [
  'lib/platform-v7/deal-execution-source-of-truth.ts',
  'lib/platform-v7/workflow-source-of-truth.ts',
  'lib/platform-v7/role-lens.ts',
];

describe('PR 18.0 — Deal Execution SOT — source guard', () => {
  for (const file of SOT_FILES) {
    it(`${file} exists`, () => {
      expect(existsSync(file)).toBe(true);
    });
    it(`${file} has no live network calls`, async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/axios\s*\./);
      expect(src).not.toMatch(/http\s*\./);
    });
  }
});

// ──────────────────────────────────────────────
// deal-execution-source-of-truth — lookups
// ──────────────────────────────────────────────
import {
  selectDealExecutionCase,
  selectDealMoneyState,
  selectDealSdizLifecycle,
  isSdizLifecycleBlockingMoneyRelease,
  selectDealDocumentMatrix,
  selectBlockingDealDocuments,
  selectDealLogisticsTripPlan,
  selectDealTransportDocumentPack,
  isTransportPackBlockingBankBasis,
  calculateDealMoneyFormulaAmount,
  calculateDealMoneyAllocationAmount,
  isDealMoneyStateBalanced,
  calculateElevatorWeightImpact,
  createSupportTicket,
  formatRub,
  formatTons,
  executionReadinessScore,
  executionBlockers,
  canRequestMoneyRelease,
  expectedDealAmountRub,
  executionSummary,
  DL_9106_EXECUTION_CASE,
  PLATFORM_V7_WHEAT_4_CLASS_TERMS,
  calculateLabQualityImpact,
} from '@/lib/platform-v7/deal-execution-source-of-truth';
import type {
  MoneyState,
  ElevatorWeightImpactInput,
  SupportTicketInput,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('selectDealExecutionCase', () => {
  it('returns execution case for DL-9106', () => {
    const result = selectDealExecutionCase('DL-9106');
    expect(result).toBeDefined();
    expect(result?.dealId).toBe('DL-9106');
  });

  it('returns undefined for unknown dealId', () => {
    expect(selectDealExecutionCase('UNKNOWN-999')).toBeUndefined();
  });

  it('returned case has commodity, money, fgis, logistics, documents, rolesState', () => {
    const result = selectDealExecutionCase('DL-9106')!;
    expect(result.commodity).toBeDefined();
    expect(result.money).toBeDefined();
    expect(result.fgis).toBeDefined();
    expect(result.logistics).toBeDefined();
    expect(result.documents).toBeDefined();
    expect(result.rolesState).toBeDefined();
  });
});

describe('selectDealMoneyState', () => {
  it('returns money state for DL-9106', () => {
    const money = selectDealMoneyState('DL-9106');
    expect(money).toBeDefined();
    expect(money?.reserveAmount).toBeGreaterThan(0);
  });

  it('returns undefined for unknown dealId', () => {
    expect(selectDealMoneyState('UNKNOWN-999')).toBeUndefined();
  });
});

describe('selectDealSdizLifecycle', () => {
  it('returns 6 SDIZ lifecycle steps for DL-9106', () => {
    const steps = selectDealSdizLifecycle('DL-9106');
    expect(steps).toHaveLength(6);
  });

  it('each step has required fields', () => {
    const steps = selectDealSdizLifecycle('DL-9106');
    for (const step of steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.status).toBeTruthy();
      expect(step.responsibleRole).toBeTruthy();
      expect(step.nextAction).toBeTruthy();
      expect(typeof step.blocksMoneyRelease).toBe('boolean');
    }
  });

  it('returns empty array for unknown dealId', () => {
    expect(selectDealSdizLifecycle('UNKNOWN-999')).toHaveLength(0);
  });

  it('steps include fgis_party_created and sdiz_issued', () => {
    const ids = selectDealSdizLifecycle('DL-9106').map((s) => s.id);
    expect(ids).toContain('fgis_party_created');
    expect(ids).toContain('sdiz_issued');
    expect(ids).toContain('sdiz_redeemed');
  });
});

describe('isSdizLifecycleBlockingMoneyRelease', () => {
  it('returns true for DL-9106 (SDIZ not complete)', () => {
    expect(isSdizLifecycleBlockingMoneyRelease('DL-9106')).toBe(true);
  });

  it('returns false for unknown dealId', () => {
    expect(isSdizLifecycleBlockingMoneyRelease('UNKNOWN-999')).toBe(false);
  });
});

describe('selectDealDocumentMatrix', () => {
  it('returns non-empty document list for DL-9106', () => {
    const docs = selectDealDocumentMatrix('DL-9106');
    expect(docs.length).toBeGreaterThan(0);
  });

  it('each document has required fields', () => {
    const docs = selectDealDocumentMatrix('DL-9106');
    for (const doc of docs) {
      expect(doc.documentId).toBeTruthy();
      expect(doc.title).toBeTruthy();
      expect(doc.responsibleRole).toBeTruthy();
      expect(doc.blocksStage).toBeTruthy();
    }
  });
});

describe('selectBlockingDealDocuments', () => {
  it('returns subset of documents that block money release', () => {
    const all = selectDealDocumentMatrix('DL-9106');
    const blocking = selectBlockingDealDocuments('DL-9106');
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.length).toBeLessThanOrEqual(all.length);
  });
});

describe('selectDealLogisticsTripPlan', () => {
  it('returns plan for DL-9106 with 3 trips', () => {
    const plan = selectDealLogisticsTripPlan('DL-9106');
    expect(plan.vehicleCount).toBe(3);
    expect(plan.trips).toHaveLength(3);
    expect(plan.tripIds).toHaveLength(3);
  });

  it('has correct plannedTons matching declared', () => {
    const plan = selectDealLogisticsTripPlan('DL-9106');
    expect(plan.plannedTons).toBe(plan.declaredTons);
    expect(plan.isCompletePlan).toBe(true);
  });

  it('includes epdPackage reference', () => {
    const plan = selectDealLogisticsTripPlan('DL-9106');
    expect(plan.epdPackage).toBeDefined();
  });
});

describe('selectDealTransportDocumentPack', () => {
  it('returns transport pack for DL-9106', () => {
    const pack = selectDealTransportDocumentPack('DL-9106');
    expect(pack).toBeDefined();
    expect(pack?.etrnId).toBeTruthy();
    expect(pack?.titles).toHaveLength(4);
  });
});

describe('isTransportPackBlockingBankBasis', () => {
  it('returns true when pack is undefined', () => {
    expect(isTransportPackBlockingBankBasis(undefined)).toBe(true);
  });

  it('returns true for DL-9106 pack (signatures not complete)', () => {
    const pack = selectDealTransportDocumentPack('DL-9106');
    expect(isTransportPackBlockingBankBasis(pack)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// money calculations
// ──────────────────────────────────────────────
const makeMoneyState = (overrides: Partial<MoneyState> = {}): MoneyState => ({
  goodsAmount: 9_648_000,
  vatAmount: 0,
  logisticsAmount: 0,
  platformFee: 0,
  qualityAdjustmentAmount: 0,
  weightAdjustmentAmount: 0,
  reserveAmount: 9_648_000,
  heldAmount: 0,
  manualReviewAmount: 9_648_000,
  readyToReleaseAmount: 0,
  releasedAmount: 0,
  refundAmount: 0,
  calculationFormula: 'test formula',
  bankStatus: 'test status',
  reconciliationStatus: 'test',
  ...overrides,
});

describe('calculateDealMoneyFormulaAmount', () => {
  it('returns goodsAmount when no adjustments', () => {
    expect(calculateDealMoneyFormulaAmount(makeMoneyState())).toBe(9_648_000);
  });

  it('adds logistics and fee', () => {
    const amount = calculateDealMoneyFormulaAmount(makeMoneyState({ logisticsAmount: 100_000, platformFee: 50_000 }));
    expect(amount).toBe(9_648_000 + 100_000 + 50_000);
  });

  it('subtracts quality and weight adjustments', () => {
    const amount = calculateDealMoneyFormulaAmount(makeMoneyState({ qualityAdjustmentAmount: 200_000, weightAdjustmentAmount: 100_000 }));
    expect(amount).toBe(9_648_000 - 200_000 - 100_000);
  });
});

describe('calculateDealMoneyAllocationAmount', () => {
  it('sums held, manualReview, readyToRelease, released, refund', () => {
    const state = makeMoneyState({
      heldAmount: 100_000,
      manualReviewAmount: 200_000,
      readyToReleaseAmount: 300_000,
      releasedAmount: 400_000,
      refundAmount: 50_000,
    });
    expect(calculateDealMoneyAllocationAmount(state)).toBe(1_050_000);
  });

  it('returns 0 for all-zero state', () => {
    const state = makeMoneyState({
      heldAmount: 0,
      manualReviewAmount: 0,
      readyToReleaseAmount: 0,
      releasedAmount: 0,
      refundAmount: 0,
    });
    expect(calculateDealMoneyAllocationAmount(state)).toBe(0);
  });
});

describe('isDealMoneyStateBalanced', () => {
  it('returns true when formula == reserve AND allocation == reserve', () => {
    const state = makeMoneyState({
      goodsAmount: 1_000,
      vatAmount: 0,
      reserveAmount: 1_000,
      heldAmount: 0,
      manualReviewAmount: 1_000,
      readyToReleaseAmount: 0,
      releasedAmount: 0,
      refundAmount: 0,
    });
    expect(isDealMoneyStateBalanced(state)).toBe(true);
  });

  it('returns false when formula does not match reserve', () => {
    const state = makeMoneyState({
      goodsAmount: 1_000,
      reserveAmount: 2_000,
      manualReviewAmount: 2_000,
    });
    expect(isDealMoneyStateBalanced(state)).toBe(false);
  });
});

// ──────────────────────────────────────────────
// elevator weight impact
// ──────────────────────────────────────────────
const makeWeightInput = (overrides: Partial<ElevatorWeightImpactInput> = {}): ElevatorWeightImpactInput => ({
  dealId: 'DL-9106',
  declaredTons: 600,
  grossTons: 620,
  tareTons: 18,
  moistureAdjustmentTons: 2,
  impurityAdjustmentTons: 0,
  pricePerTon: 16_080,
  ...overrides,
});

describe('calculateElevatorWeightImpact', () => {
  it('calculates net and accepted tons', () => {
    const result = calculateElevatorWeightImpact(makeWeightInput());
    expect(result.netTons).toBeCloseTo(620 - 18, 2);
    expect(result.acceptedTons).toBeCloseTo(620 - 18 - 2, 2);
  });

  it('no weight delta when accepted >= declared', () => {
    const result = calculateElevatorWeightImpact(makeWeightInput({ grossTons: 640, tareTons: 18, moistureAdjustmentTons: 2 }));
    expect(result.deltaTons).toBe(0);
    expect(result.disputeTrigger).toBe(false);
    expect(result.draftDiscrepancyActRequired).toBe(false);
    expect(result.weightAdjustmentAmount).toBe(0);
  });

  it('creates hold amount when accepted < declared', () => {
    const result = calculateElevatorWeightImpact(makeWeightInput());
    if (result.deltaTons > 0) {
      expect(result.holdAmount).toBeGreaterThan(0);
      expect(result.disputeTrigger).toBe(true);
      expect(result.draftDiscrepancyActRequired).toBe(true);
    }
  });

  it('holdAmount equals weightAdjustmentAmount', () => {
    const result = calculateElevatorWeightImpact(makeWeightInput());
    expect(result.holdAmount).toBe(result.weightAdjustmentAmount);
  });

  it('includes dealId in result', () => {
    expect(calculateElevatorWeightImpact(makeWeightInput()).dealId).toBe('DL-9106');
  });
});

// ──────────────────────────────────────────────
// lab quality impact
// ──────────────────────────────────────────────
describe('calculateLabQualityImpact', () => {
  const perfectProtocol = {
    crop: 'Пшеница',
    class: '4 класс',
    moisture: 13,
    nature: 750,
    protein: 12,
    gluten: 20,
    idk: 90,
    fallingNumber: 200,
    weedImpurity: 1,
    grainImpurity: 4,
    infestation: 'не обнаружена',
    protocolNumber: 'LAB-001',
    method: 'GOST',
    laboratory: 'ЦЛ «Восток»',
    signer: 'Ivan',
    kepStatus: 'подписан',
    measuredAt: '2026-01-01T12:00:00Z',
  };

  const badProtocol = {
    ...perfectProtocol,
    class: '5 класс',
    moisture: 16,
    protein: 10,
    infestation: 'умеренная',
  };

  it('returns zero adjustments for perfect protocol', () => {
    const result = calculateLabQualityImpact(DL_9106_EXECUTION_CASE, perfectProtocol, PLATFORM_V7_WHEAT_4_CLASS_TERMS);
    expect(result.qualityDelta).toHaveLength(0);
    expect(result.priceAdjustmentPerTon).toBe(0);
    expect(result.holdAmount).toBe(0);
    expect(result.disputeTrigger).toBe(false);
  });

  it('returns adjustments for bad protocol', () => {
    const result = calculateLabQualityImpact(DL_9106_EXECUTION_CASE, badProtocol, PLATFORM_V7_WHEAT_4_CLASS_TERMS);
    expect(result.qualityDelta.length).toBeGreaterThan(0);
    expect(result.priceAdjustmentPerTon).toBeGreaterThan(0);
    expect(result.holdAmount).toBeGreaterThan(0);
    expect(result.disputeTrigger).toBe(true);
  });

  it('bankStatus reflects quality state', () => {
    const good = calculateLabQualityImpact(DL_9106_EXECUTION_CASE, perfectProtocol, PLATFORM_V7_WHEAT_4_CLASS_TERMS);
    expect(good.bankStatus).toContain('закрыто');
    const bad = calculateLabQualityImpact(DL_9106_EXECUTION_CASE, badProtocol, PLATFORM_V7_WHEAT_4_CLASS_TERMS);
    expect(bad.bankStatus).toContain('не закрыто');
  });
});

// ──────────────────────────────────────────────
// support ticket
// ──────────────────────────────────────────────
describe('createSupportTicket', () => {
  const makeInput = (overrides: Partial<SupportTicketInput> = {}): SupportTicketInput => ({
    ticketId: 'TKT-001',
    linkedDealId: 'DL-9106',
    category: 'document_blocker',
    priority: 'high',
    createdAt: '2026-01-01T10:00:00.000Z',
    slaHours: 4,
    moneyAtRisk: 9_648_000,
    ownerRole: 'support_agent',
    nextAction: 'проверить документы',
    escalationPath: ['support_agent', 'operator'],
    ...overrides,
  });

  it('creates ticket with status=open', () => {
    const ticket = createSupportTicket(makeInput());
    expect(ticket.status).toBe('open');
  });

  it('sets slaDeadline to createdAt + slaHours', () => {
    const ticket = createSupportTicket(makeInput());
    const expected = new Date('2026-01-01T14:00:00.000Z').toISOString();
    expect(ticket.slaDeadline).toBe(expected);
  });

  it('preserves all input fields', () => {
    const ticket = createSupportTicket(makeInput());
    expect(ticket.ticketId).toBe('TKT-001');
    expect(ticket.linkedDealId).toBe('DL-9106');
    expect(ticket.moneyAtRisk).toBe(9_648_000);
  });

  it('creates one audit event at creation time', () => {
    const ticket = createSupportTicket(makeInput());
    expect(ticket.auditEvents).toHaveLength(1);
    expect(ticket.auditEvents[0].action).toBe('support_ticket_created');
  });
});

// ──────────────────────────────────────────────
// formatters
// ──────────────────────────────────────────────
describe('formatRub', () => {
  it('formats 9648000 with Russian locale and ₽ symbol', () => {
    const result = formatRub(9_648_000);
    expect(result).toContain('₽');
    expect(result).toContain('9');
  });

  it('formats 0 as "0 ₽"', () => {
    expect(formatRub(0)).toContain('₽');
  });
});

describe('formatTons', () => {
  it('formats tons with т symbol', () => {
    const result = formatTons(600);
    expect(result).toContain('т');
    expect(result).toContain('600');
  });
});

// ──────────────────────────────────────────────
// execution readiness
// ──────────────────────────────────────────────
describe('executionReadinessScore', () => {
  it('returns a number between 0 and 100', () => {
    const score = executionReadinessScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('executionBlockers', () => {
  it('returns non-empty array (DL-9106 has multiple blockers)', () => {
    const blockers = executionBlockers();
    expect(Array.isArray(blockers)).toBe(true);
    expect(blockers.length).toBeGreaterThan(0);
  });

  it('does not include empty blocker strings', () => {
    expect(executionBlockers().every((b) => b.length > 0)).toBe(true);
  });
});

describe('canRequestMoneyRelease', () => {
  it('returns false for DL-9106 (not all gates ready)', () => {
    expect(canRequestMoneyRelease()).toBe(false);
  });
});

describe('expectedDealAmountRub', () => {
  it('returns volumeTons * pricePerTon', () => {
    expect(expectedDealAmountRub()).toBe(600 * 16_080);
  });
});

describe('executionSummary', () => {
  it('returns summary with dealId, readinessScore, blockers, canRelease', () => {
    const summary = executionSummary();
    expect(summary.dealId).toBe('DL-9106');
    expect(typeof summary.readinessScore).toBe('number');
    expect(Array.isArray(summary.blockers)).toBe(true);
    expect(typeof summary.canRelease).toBe('boolean');
    expect(summary.canRelease).toBe(false);
  });
});

// ──────────────────────────────────────────────
// workflow-source-of-truth
// ──────────────────────────────────────────────
import {
  getWorkflowDashboardModel,
  runWorkflowAction,
} from '@/lib/platform-v7/workflow-source-of-truth';
import type { WorkflowActionContext } from '@/lib/platform-v7/workflow-source-of-truth';

const WORKFLOW_CONTEXTS: WorkflowActionContext[] = ['seller', 'buyer', 'deal', 'operator'];

describe('getWorkflowDashboardModel', () => {
  for (const ctx of WORKFLOW_CONTEXTS) {
    it(`returns model for context "${ctx}"`, () => {
      const model = getWorkflowDashboardModel(ctx);
      expect(model.context).toBe(ctx);
      expect(model.title).toBeTruthy();
      expect(model.lead).toBeTruthy();
      expect(model.state).toBeDefined();
      expect(Array.isArray(model.actions)).toBe(true);
      expect(model.actions.length).toBeGreaterThan(0);
      expect(Array.isArray(model.auditSeed)).toBe(true);
      expect(model.auditSeed.length).toBeGreaterThan(0);
    });
  }

  it('seller model has publish_market_lot action', () => {
    const model = getWorkflowDashboardModel('seller');
    expect(model.actions.some((a) => a.kind === 'publish_market_lot')).toBe(true);
  });

  it('operator model has block_contact_leak action', () => {
    const model = getWorkflowDashboardModel('operator');
    expect(model.actions.some((a) => a.kind === 'block_contact_leak')).toBe(true);
  });
});

describe('runWorkflowAction', () => {
  const baseState = getWorkflowDashboardModel('seller').state;

  it('returns state, auditEvent, and toast', () => {
    const action = getWorkflowDashboardModel('seller').actions[0];
    const result = runWorkflowAction(action, baseState);
    expect(result.state).toBeDefined();
    expect(result.auditEvent).toBeDefined();
    expect(result.toast).toBeTruthy();
  });

  it('publish_market_lot changes lotStatus', () => {
    const action = getWorkflowDashboardModel('seller').actions.find((a) => a.kind === 'publish_market_lot')!;
    const result = runWorkflowAction(action, baseState);
    expect(result.state.lotStatus).not.toBe(baseState.lotStatus);
  });

  it('accept_offer_to_draft creates deal draft status', () => {
    const action = getWorkflowDashboardModel('seller').actions.find((a) => a.kind === 'accept_offer_to_draft')!;
    const result = runWorkflowAction(action, baseState);
    expect(result.state.dealDraftStatus).toContain('черновик');
  });

  it('auditEvent has action matching workflow kind', () => {
    const action = getWorkflowDashboardModel('seller').actions[0];
    const result = runWorkflowAction(action, baseState);
    expect(result.auditEvent.action).toBe(action.kind);
  });

  it('auditEvent has dealId when action has dealId', () => {
    const action = getWorkflowDashboardModel('seller').actions.find((a) => a.dealId)!;
    const result = runWorkflowAction(action, baseState);
    expect(result.auditEvent.dealId).toBe(action.dealId);
  });
});

// ──────────────────────────────────────────────
// role-lens
// ──────────────────────────────────────────────
import { canSee, visibleAtoms, ROLE_LENS } from '@/lib/platform-v7/role-lens';
import type { DataAtom } from '@/lib/platform-v7/role-lens';

describe('canSee', () => {
  it('operator can see all atoms', () => {
    const atoms: DataAtom[] = ['deal_reserve_amount', 'deal_price_per_ton', 'compliance_audit_log', 'executive_portfolio_summary'];
    for (const atom of atoms) {
      expect(canSee('operator', atom)).toBe(true);
    }
  });

  it('driver sees logistics_route and logistics_gps only', () => {
    expect(canSee('driver', 'logistics_route')).toBe(true);
    expect(canSee('driver', 'logistics_gps')).toBe(true);
    expect(canSee('driver', 'deal_price_per_ton')).toBe(false);
    expect(canSee('driver', 'bank_decision')).toBe(false);
    expect(canSee('driver', 'deal_reserve_amount')).toBe(false);
  });

  it('lab sees quality_protocol and quality_gost_params only', () => {
    expect(canSee('lab', 'quality_protocol')).toBe(true);
    expect(canSee('lab', 'quality_gost_params')).toBe(true);
    expect(canSee('lab', 'deal_reserve_amount')).toBe(false);
    expect(canSee('lab', 'bank_decision')).toBe(false);
  });

  it('bank does not see deal_price_per_ton', () => {
    expect(canSee('bank', 'deal_price_per_ton')).toBe(false);
  });

  it('bank sees deal_reserve_amount, bank_decision, bank_release_basis', () => {
    expect(canSee('bank', 'deal_reserve_amount')).toBe(true);
    expect(canSee('bank', 'bank_decision')).toBe(true);
    expect(canSee('bank', 'bank_release_basis')).toBe(true);
  });

  it('seller does not see bank_decision', () => {
    expect(canSee('seller', 'bank_decision')).toBe(false);
  });

  it('buyer does not see deal_counterparty_name', () => {
    expect(canSee('buyer', 'deal_counterparty_name')).toBe(false);
  });

  it('compliance sees compliance_audit_log', () => {
    expect(canSee('compliance', 'compliance_audit_log')).toBe(true);
  });

  it('executive sees executive_portfolio_summary', () => {
    expect(canSee('executive', 'executive_portfolio_summary')).toBe(true);
  });

  it('driver does not see executive_portfolio_summary', () => {
    expect(canSee('driver', 'executive_portfolio_summary')).toBe(false);
  });
});

describe('visibleAtoms', () => {
  it('operator sees all 20 atoms', () => {
    expect(visibleAtoms('operator')).toHaveLength(20);
  });

  it('driver sees exactly 2 atoms', () => {
    const atoms = visibleAtoms('driver');
    expect(atoms).toHaveLength(2);
    expect(atoms).toContain('logistics_route');
    expect(atoms).toContain('logistics_gps');
  });

  it('lab sees exactly 2 atoms', () => {
    const atoms = visibleAtoms('lab');
    expect(atoms).toHaveLength(2);
  });

  it('visible atoms are a subset of all atoms', () => {
    const roles = Object.keys(ROLE_LENS) as Array<keyof typeof ROLE_LENS>;
    for (const role of roles) {
      const atoms = visibleAtoms(role);
      for (const atom of atoms) {
        expect(canSee(role, atom)).toBe(true);
      }
    }
  });
});

describe('ROLE_LENS', () => {
  it('contains entries for all expected roles', () => {
    const expectedRoles = ['operator', 'executive', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance'];
    for (const role of expectedRoles) {
      expect(ROLE_LENS[role as keyof typeof ROLE_LENS]).toBeDefined();
    }
  });
});
