import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PLATFORM_V7_DEAL_WORKSPACE_TABS,
  platformV7DealWorkspaceModel,
  platformV7DealWorkspaceTabByHash,
  platformV7DealWorkspaceTabById,
} from '@/lib/platform-v7/deal-workspace';

import {
  platformV7DealDocumentsModel,
  platformV7DealDocumentBadgeTone,
  platformV7DealDocumentRequiresSignature,
  type PlatformV7DealDocument,
} from '@/lib/platform-v7/deal-workspace-documents';

import {
  platformV7DealLogisticsModel,
  platformV7DealLogisticsBadgeTone,
  type PlatformV7DealLogisticsTrip,
} from '@/lib/platform-v7/deal-workspace-logistics';

import {
  calculatePlatformV7DealFinancialTerms,
  platformV7DealFinancialTermsAreBalanced,
} from '@/lib/platform-v7/deal-financial-terms';

import {
  platformV7DealReleaseReadinessModel,
  platformV7DealReleaseReadinessTone,
} from '@/lib/platform-v7/deal-workspace-release-readiness';

import {
  PLATFORM_V7_DEAL_WORKSPACE_ACTIONS,
  platformV7DealWorkspaceActions,
  platformV7DealWorkspaceActionById,
  platformV7DealWorkspaceActionPlan,
  platformV7DealWorkspaceActionPlanIsValid,
  platformV7DealWorkspaceEvaluateAction,
  platformV7DealWorkspaceSafeActionPlan,
  platformV7DealWorkspaceActionHasFullReleaseGuard,
  platformV7DealWorkspaceActionHasRuntimeRequirements,
  platformV7DealWorkspaceActionRequiresTraceableWrite,
  platformV7DealWorkspaceActionRuntimeServices,
  platformV7DealWorkspaceGateLabel,
} from '@/lib/platform-v7/deal-workspace-actions';

import {
  sortPlatformV7DealTimeline,
  filterPlatformV7DealTimeline,
  platformV7DealTimelineEventKey,
  platformV7DealTimelineSummary,
  type PlatformV7DealTimelineEvent,
} from '@/lib/platform-v7/deal-workspace-timeline';

import {
  platformV7DealWorkspaceSidePanelModel,
  platformV7DealWorkspaceNextOwnerTone,
  platformV7DealWorkspaceSidePanelIsValid,
} from '@/lib/platform-v7/deal-workspace-sidepanel';

describe('deal-workspace — tabs and model', () => {
  it('has exactly 5 tabs', () => {
    expect(PLATFORM_V7_DEAL_WORKSPACE_TABS).toHaveLength(5);
  });

  it('tab ids are overview, documents, logistics, money, dispute', () => {
    const ids = PLATFORM_V7_DEAL_WORKSPACE_TABS.map((t) => t.id);
    expect(ids).toContain('overview');
    expect(ids).toContain('documents');
    expect(ids).toContain('logistics');
    expect(ids).toContain('money');
    expect(ids).toContain('dispute');
  });

  it('each tab has label, hash, description', () => {
    for (const tab of PLATFORM_V7_DEAL_WORKSPACE_TABS) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.hash).toMatch(/^#/);
      expect(tab.description.length).toBeGreaterThan(0);
    }
  });

  it('platformV7DealWorkspaceModel returns expected constants', () => {
    const model = platformV7DealWorkspaceModel();
    expect(model.defaultTab).toBe('overview');
    expect(model.maxPrimaryActions).toBe(1);
    expect(model.maxSecondaryActions).toBe(2);
    expect(model.mobileSidePanel).toBe('bottom-sheet');
  });

  it('platformV7DealWorkspaceTabByHash returns correct tab', () => {
    const tab = platformV7DealWorkspaceTabByHash('#documents');
    expect(tab.id).toBe('documents');
  });

  it('platformV7DealWorkspaceTabByHash falls back to overview for unknown hash', () => {
    const tab = platformV7DealWorkspaceTabByHash('#nonexistent');
    expect(tab.id).toBe('overview');
  });

  it('platformV7DealWorkspaceTabById returns correct tab', () => {
    const tab = platformV7DealWorkspaceTabById('money');
    expect(tab.id).toBe('money');
    expect(tab.hash).toBe('#money');
  });
});

describe('deal-workspace-documents — documents model', () => {
  const makeDocs = (statuses: PlatformV7DealDocument['status'][]): PlatformV7DealDocument[] =>
    statuses.map((status, i) => ({
      id: `doc-${i}`,
      kind: 'contract' as const,
      title: `Document ${i}`,
      status,
      version: 1,
      updatedAt: `2024-01-0${i + 1}T00:00:00Z`,
    }));

  it('all signed: blocksRelease is false, completeness 100', () => {
    const model = platformV7DealDocumentsModel(makeDocs(['signed', 'signed', 'signed']));
    expect(model.blocksRelease).toBe(false);
    expect(model.completeness).toBe(100);
    expect(model.signed).toBe(3);
  });

  it('missing doc blocks release', () => {
    const model = platformV7DealDocumentsModel(makeDocs(['signed', 'missing']));
    expect(model.blocksRelease).toBe(true);
    expect(model.missing).toBe(1);
  });

  it('rejected doc blocks release', () => {
    const model = platformV7DealDocumentsModel(makeDocs(['signed', 'rejected']));
    expect(model.blocksRelease).toBe(true);
    expect(model.rejected).toBe(1);
  });

  it('empty documents: completeness 0, total 0', () => {
    const model = platformV7DealDocumentsModel([]);
    expect(model.completeness).toBe(0);
    expect(model.total).toBe(0);
    expect(model.signed).toBe(0);
  });

  it('documents sorted newest-first', () => {
    const docs = makeDocs(['signed', 'signed', 'signed']);
    const model = platformV7DealDocumentsModel(docs);
    const dates = model.documents.map((d) => d.updatedAt);
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]! >= dates[i + 1]!).toBe(true);
    }
  });

  it('platformV7DealDocumentBadgeTone: signed → success', () => {
    expect(platformV7DealDocumentBadgeTone('signed')).toBe('success');
  });

  it('platformV7DealDocumentBadgeTone: missing → danger', () => {
    expect(platformV7DealDocumentBadgeTone('missing')).toBe('danger');
  });

  it('platformV7DealDocumentBadgeTone: draft → warning', () => {
    expect(platformV7DealDocumentBadgeTone('draft')).toBe('warning');
  });

  it('platformV7DealDocumentRequiresSignature: ready or draft → true', () => {
    const doc: PlatformV7DealDocument = { id: 'd1', kind: 'invoice', title: 'Test', status: 'ready', version: 1, updatedAt: '' };
    expect(platformV7DealDocumentRequiresSignature(doc)).toBe(true);
    expect(platformV7DealDocumentRequiresSignature({ ...doc, status: 'draft' })).toBe(true);
    expect(platformV7DealDocumentRequiresSignature({ ...doc, status: 'signed' })).toBe(false);
  });
});

describe('deal-workspace-logistics — logistics model', () => {
  const makeTrip = (overrides: Partial<PlatformV7DealLogisticsTrip> = {}): PlatformV7DealLogisticsTrip => ({
    id: 'trip-1',
    carrier: 'ТК Агро',
    driver: 'Иванов И.И.',
    vehicle: 'А123BC',
    status: 'accepted',
    blockers: [],
    ettnStatus: 'signed',
    ...overrides,
  });

  it('null trip: blocksRelease true, no hasActiveTrip', () => {
    const model = platformV7DealLogisticsModel(null);
    expect(model.hasActiveTrip).toBe(false);
    expect(model.blocksRelease).toBe(true);
    expect(model.blockers).toContain('driver-not-confirmed');
  });

  it('accepted trip with signed ettn: blocksRelease false', () => {
    const model = platformV7DealLogisticsModel(makeTrip());
    expect(model.hasActiveTrip).toBe(true);
    expect(model.blocksRelease).toBe(false);
  });

  it('trip with unsigned ettn: blocksRelease true, missing-ettn in blockers', () => {
    const model = platformV7DealLogisticsModel(makeTrip({ ettnStatus: 'draft' }));
    expect(model.blocksRelease).toBe(true);
    expect(model.blockers).toContain('missing-ettn');
  });

  it('in_transit trip blocks release', () => {
    const model = platformV7DealLogisticsModel(makeTrip({ status: 'in_transit' }));
    expect(model.blocksRelease).toBe(true);
  });

  it('trip with route-deviation blocker blocks release', () => {
    const model = platformV7DealLogisticsModel(makeTrip({ blockers: ['route-deviation'] }));
    expect(model.blocksRelease).toBe(true);
    expect(model.blockers).toContain('route-deviation');
  });

  it('platformV7DealLogisticsBadgeTone: not blocking → success', () => {
    const model = platformV7DealLogisticsModel(makeTrip());
    expect(platformV7DealLogisticsBadgeTone(model)).toBe('success');
  });

  it('platformV7DealLogisticsBadgeTone: blocking → danger', () => {
    const model = platformV7DealLogisticsModel(null);
    expect(platformV7DealLogisticsBadgeTone(model)).toBe('danger');
  });
});

describe('deal-financial-terms — financial calculations', () => {
  it('grossAmount = pricePerTon * volumeTons', () => {
    const terms = calculatePlatformV7DealFinancialTerms({ pricePerTon: 10000, volumeTons: 100, vatRate: 20, basis: 'EXW' });
    expect(terms.grossAmount).toBe(1_000_000);
  });

  it('vatAmount and netAmount are consistent', () => {
    const terms = calculatePlatformV7DealFinancialTerms({ pricePerTon: 12000, volumeTons: 50, vatRate: 20, basis: 'FCA' });
    expect(terms.vatAmount + terms.netAmount).toBe(terms.grossAmount);
  });

  it('releaseAmount = grossAmount - holdAmount', () => {
    const terms = calculatePlatformV7DealFinancialTerms({ pricePerTon: 10000, volumeTons: 10, vatRate: 20, basis: 'CPT', holdAmount: 20000 });
    expect(terms.releaseAmount).toBe(terms.grossAmount - terms.holdAmount);
  });

  it('holdAmount is clamped to grossAmount', () => {
    const terms = calculatePlatformV7DealFinancialTerms({ pricePerTon: 1000, volumeTons: 1, vatRate: 0, basis: 'EXW', holdAmount: 99999 });
    expect(terms.holdAmount).toBe(terms.grossAmount);
    expect(terms.releaseAmount).toBe(0);
  });

  it('negative price/volume clamped to 0', () => {
    const terms = calculatePlatformV7DealFinancialTerms({ pricePerTon: -5000, volumeTons: -10, vatRate: 0, basis: 'EXW' });
    expect(terms.grossAmount).toBe(0);
  });

  it('empty basis defaults to dash', () => {
    const terms = calculatePlatformV7DealFinancialTerms({ pricePerTon: 0, volumeTons: 0, vatRate: 0, basis: '   ' });
    expect(terms.basis).toBe('—');
  });

  it('platformV7DealFinancialTermsAreBalanced: valid terms pass', () => {
    const terms = calculatePlatformV7DealFinancialTerms({ pricePerTon: 10000, volumeTons: 100, vatRate: 20, basis: 'EXW' });
    expect(platformV7DealFinancialTermsAreBalanced(terms)).toBe(true);
  });
});

describe('deal-workspace-release-readiness — gate model', () => {
  const makeDocs = (blocksRelease: boolean) => ({
    documents: [],
    total: 3,
    signed: blocksRelease ? 2 : 3,
    missing: blocksRelease ? 1 : 0,
    rejected: 0,
    completeness: blocksRelease ? 66.67 : 100,
    blocksRelease,
  });

  const makeLogistics = (blocksRelease: boolean) => ({
    hasActiveTrip: true,
    trip: null,
    blocksRelease,
    statusLabel: blocksRelease ? 'Блокирует выпуск' : 'Принят',
    blockers: [],
    evidenceRequired: false,
  });

  const makeTerms = (releaseAmount: number) => ({
    pricePerTon: 10000,
    volumeTons: 100,
    grossAmount: 1_000_000,
    vatRate: 20,
    vatAmount: 166667,
    netAmount: 833333,
    basis: 'EXW',
    penaltyRate: 0,
    holdAmount: 0,
    releaseAmount,
  });

  it('all gates pass: canRelease true', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: makeDocs(false),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(1_000_000),
      bankCallbackConfirmed: true,
      disputeOpen: false,
    });
    expect(model.canRelease).toBe(true);
    expect(model.gateStatus).toBe('pass');
    expect(model.blockerCount).toBe(0);
  });

  it('documents gate fails when blocksRelease', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: makeDocs(true),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(1_000_000),
      bankCallbackConfirmed: true,
      disputeOpen: false,
    });
    expect(model.canRelease).toBe(false);
    const docGate = model.gates.find((g) => g.id === 'documents');
    expect(docGate?.status).toBe('fail');
  });

  it('open dispute blocks release', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: makeDocs(false),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(1_000_000),
      bankCallbackConfirmed: true,
      disputeOpen: true,
    });
    expect(model.canRelease).toBe(false);
    const disputeGate = model.gates.find((g) => g.id === 'dispute');
    expect(disputeGate?.status).toBe('fail');
  });

  it('bank not confirmed → review status', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: makeDocs(false),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(1_000_000),
      bankCallbackConfirmed: false,
      disputeOpen: false,
    });
    const bankGate = model.gates.find((g) => g.id === 'bank');
    expect(bankGate?.status).toBe('review');
  });

  it('zero release amount fails money gate', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: makeDocs(false),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(0),
      bankCallbackConfirmed: true,
      disputeOpen: false,
    });
    const moneyGate = model.gates.find((g) => g.id === 'money');
    expect(moneyGate?.status).toBe('fail');
  });

  it('has exactly 5 gates', () => {
    const model = platformV7DealReleaseReadinessModel({
      documents: makeDocs(false),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(100),
      bankCallbackConfirmed: true,
      disputeOpen: false,
    });
    expect(model.gates).toHaveLength(5);
  });

  it('tone: pass → success, review → warning, fail → danger', () => {
    const passModel = platformV7DealReleaseReadinessModel({
      documents: makeDocs(false),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(100),
      bankCallbackConfirmed: true,
      disputeOpen: false,
    });
    expect(platformV7DealReleaseReadinessTone(passModel)).toBe('success');

    const reviewModel = platformV7DealReleaseReadinessModel({
      documents: makeDocs(false),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(100),
      bankCallbackConfirmed: false,
      disputeOpen: false,
    });
    expect(platformV7DealReleaseReadinessTone(reviewModel)).toBe('warning');

    const failModel = platformV7DealReleaseReadinessModel({
      documents: makeDocs(true),
      logistics: makeLogistics(false),
      financialTerms: makeTerms(100),
      bankCallbackConfirmed: true,
      disputeOpen: false,
    });
    expect(platformV7DealReleaseReadinessTone(failModel)).toBe('danger');
  });
});

describe('deal-workspace-actions — actions and gate evaluation', () => {
  it('PLATFORM_V7_DEAL_WORKSPACE_ACTIONS has 8 actions', () => {
    expect(PLATFORM_V7_DEAL_WORKSPACE_ACTIONS).toHaveLength(8);
  });

  it('platformV7DealWorkspaceActions returns all 8 actions', () => {
    expect(platformV7DealWorkspaceActions()).toHaveLength(8);
  });

  it('request-release is primary and controlled-pilot', () => {
    const action = platformV7DealWorkspaceActionById('request-release');
    expect(action.kind).toBe('primary');
    expect(action.maturityMode).toBe('controlled-pilot');
  });

  it('release-funds is irreversible', () => {
    const action = platformV7DealWorkspaceActionById('release-funds');
    expect(action.irreversible).toBe(true);
  });

  it('open-bank and open-disputes have href navigation', () => {
    expect(platformV7DealWorkspaceActionById('open-bank').href).toBeDefined();
    expect(platformV7DealWorkspaceActionById('open-disputes').href).toBeDefined();
  });

  it('action plan separates by kind', () => {
    const plan = platformV7DealWorkspaceActionPlan(['request-release', 'start-documents', 'open-bank']);
    expect(plan.primary).toHaveLength(1);
    expect(plan.primary[0]?.id).toBe('request-release');
    expect(plan.secondary).toHaveLength(1);
    expect(plan.secondary[0]?.id).toBe('start-documents');
    expect(plan.tertiary).toHaveLength(1);
  });

  it('action plan limits primary to 1', () => {
    const plan = platformV7DealWorkspaceActionPlan(['request-release', 'release-funds']);
    expect(plan.primary).toHaveLength(1);
  });

  it('platformV7DealWorkspaceActionPlanIsValid: valid plan passes', () => {
    const plan = platformV7DealWorkspaceActionPlan(['request-release', 'start-documents']);
    expect(platformV7DealWorkspaceActionPlanIsValid(plan)).toBe(true);
  });

  it('gateLabel returns string for each gate', () => {
    const gateIds = ['money', 'documents', 'fgis', 'transport', 'quality', 'evidence', 'compliance', 'degradation'] as const;
    for (const gateId of gateIds) {
      expect(platformV7DealWorkspaceGateLabel(gateId).length).toBeGreaterThan(0);
    }
  });

  it('evaluateAction: enabled when no required gates', () => {
    const evaluation = platformV7DealWorkspaceEvaluateAction('start-documents', []);
    expect(evaluation.enabled).toBe(true);
    expect(evaluation.blockers).toHaveLength(0);
  });

  it('evaluateAction: disabled with blockers when required gate fails', () => {
    const gates = [{ id: 'money' as const, passed: false, reason: 'MoneyGate not confirmed' }];
    const evaluation = platformV7DealWorkspaceEvaluateAction('request-release', gates);
    expect(evaluation.enabled).toBe(false);
    expect(evaluation.blockers.length).toBeGreaterThan(0);
  });

  it('evaluateAction: enabled when all required gates pass', () => {
    const requiredGates = (['money', 'documents', 'transport', 'fgis', 'degradation'] as const).map((id) => ({
      id,
      passed: true,
    }));
    const evaluation = platformV7DealWorkspaceEvaluateAction('request-release', requiredGates);
    expect(evaluation.enabled).toBe(true);
  });

  it('safeActionPlan includes evaluations with enabled and blockers', () => {
    const safe = platformV7DealWorkspaceSafeActionPlan(['request-release', 'open-bank'], []);
    expect(safe.primary).toHaveLength(1);
    expect(safe.primary[0]).toHaveProperty('enabled');
    expect(safe.primary[0]).toHaveProperty('blockers');
  });

  it('release-funds has full release guard', () => {
    expect(platformV7DealWorkspaceActionHasFullReleaseGuard('release-funds')).toBe(true);
  });

  it('open-bank has no runtime requirements', () => {
    expect(platformV7DealWorkspaceActionHasRuntimeRequirements('open-bank')).toBe(false);
  });

  it('request-release requires traceable write', () => {
    expect(platformV7DealWorkspaceActionRequiresTraceableWrite('request-release')).toBe(true);
  });

  it('request-release has runtime services including audit', () => {
    const services = platformV7DealWorkspaceActionRuntimeServices('request-release');
    expect(services.length).toBeGreaterThan(0);
    expect(services).toContain('audit');
  });
});

describe('deal-workspace-timeline — sort, filter, summary', () => {
  const makeEvents = (): PlatformV7DealTimelineEvent[] => [
    { id: 'e1', type: 'money', actor: 'seller', action: 'request release', at: '2024-03-01T10:00:00Z', severity: 'info' },
    { id: 'e2', type: 'document', actor: 'seller', action: 'upload contract', at: '2024-03-02T10:00:00Z', severity: 'success' },
    { id: 'e3', type: 'logistics', actor: 'driver', action: 'trip started', at: '2024-02-28T10:00:00Z', severity: 'warning' },
    { id: 'e4', type: 'dispute', actor: 'buyer', action: 'open dispute', at: '2024-03-03T10:00:00Z', severity: 'danger' },
  ];

  it('sortPlatformV7DealTimeline returns newest first', () => {
    const sorted = sortPlatformV7DealTimeline(makeEvents());
    expect(sorted[0]!.id).toBe('e4');
    expect(sorted[sorted.length - 1]!.id).toBe('e3');
  });

  it('filterPlatformV7DealTimeline by type', () => {
    const events = filterPlatformV7DealTimeline(makeEvents(), { type: 'money' });
    expect(events.every((e) => e.type === 'money')).toBe(true);
  });

  it('filterPlatformV7DealTimeline by actor', () => {
    const events = filterPlatformV7DealTimeline(makeEvents(), { actor: 'seller' });
    expect(events.every((e) => e.actor === 'seller')).toBe(true);
  });

  it('filterPlatformV7DealTimeline by severity', () => {
    const events = filterPlatformV7DealTimeline(makeEvents(), { severity: 'danger' });
    expect(events.every((e) => e.severity === 'danger')).toBe(true);
  });

  it('platformV7DealTimelineEventKey contains id and timestamp', () => {
    const event = makeEvents()[0]!;
    const key = platformV7DealTimelineEventKey(event);
    expect(key).toContain(event.id);
    expect(key).toContain(event.at);
  });

  it('platformV7DealTimelineSummary counts by type', () => {
    const summary = platformV7DealTimelineSummary(makeEvents());
    expect(summary.money).toBe(1);
    expect(summary.document).toBe(1);
    expect(summary.logistics).toBe(1);
    expect(summary.dispute).toBe(1);
    expect(summary.status).toBe(0);
  });
});

describe('deal-workspace-sidepanel — side panel model', () => {
  const makeTimeline = (): PlatformV7DealTimelineEvent[] => [
    { id: 'e1', type: 'status', actor: 'system', action: 'deal created', at: '2024-03-01T10:00:00Z', severity: 'info' },
  ];

  const makeNextOwner = (critical = false) => ({
    role: 'bank',
    label: 'Банк',
    slaDeadline: critical ? '2024-03-05T00:00:00Z' : undefined,
    critical,
  });

  it('builds side panel model with actions and timeline', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: makeNextOwner(),
      actionIds: ['request-release', 'open-bank'],
      timeline: makeTimeline(),
    });
    expect(model.actions.primary).toHaveLength(1);
    expect(model.timelineCount).toBe(1);
    expect(model.layout).toBe('desktop-sidepanel-mobile-bottom-sheet');
  });

  it('safeActions is null when no gateStates provided', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: makeNextOwner(),
      actionIds: ['request-release'],
      timeline: makeTimeline(),
    });
    expect(model.safeActions).toBeNull();
  });

  it('safeActions populated when gateStates provided', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: makeNextOwner(),
      actionIds: ['request-release'],
      timeline: makeTimeline(),
      gateStates: [{ id: 'money', passed: true }],
    });
    expect(model.safeActions).not.toBeNull();
  });

  it('releaseGuard not-requested when release-funds not in actions', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: makeNextOwner(),
      actionIds: ['open-bank'],
      timeline: [],
    });
    expect(model.releaseGuard.maturityMode).toBe('not-requested');
  });

  it('releaseGuard is controlled-pilot when release-funds evaluated', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: makeNextOwner(),
      actionIds: ['release-funds'],
      timeline: [],
      gateStates: [{ id: 'money', passed: true }],
    });
    expect(model.releaseGuard.maturityMode).toBe('controlled-pilot');
  });

  it('platformV7DealWorkspaceNextOwnerTone: critical → danger', () => {
    expect(platformV7DealWorkspaceNextOwnerTone(makeNextOwner(true))).toBe('danger');
  });

  it('platformV7DealWorkspaceNextOwnerTone: with slaDeadline → warning', () => {
    const owner = { role: 'seller', label: 'Продавец', slaDeadline: '2024-03-05T00:00:00Z', critical: false };
    expect(platformV7DealWorkspaceNextOwnerTone(owner)).toBe('warning');
  });

  it('platformV7DealWorkspaceNextOwnerTone: no deadline → neutral', () => {
    expect(platformV7DealWorkspaceNextOwnerTone(makeNextOwner(false))).toBe('neutral');
  });

  it('platformV7DealWorkspaceSidePanelIsValid returns true for valid model', () => {
    const model = platformV7DealWorkspaceSidePanelModel({
      nextOwner: makeNextOwner(),
      actionIds: ['request-release', 'open-bank'],
      timeline: [],
    });
    expect(platformV7DealWorkspaceSidePanelIsValid(model)).toBe(true);
  });
});

describe('source guard: deal workspace files have no live calls', () => {
  const dealFiles = [
    'lib/platform-v7/deal-workspace.ts',
    'lib/platform-v7/deal-workspace-documents.ts',
    'lib/platform-v7/deal-workspace-logistics.ts',
    'lib/platform-v7/deal-workspace-release-readiness.ts',
    'lib/platform-v7/deal-workspace-actions.ts',
    'lib/platform-v7/deal-workspace-timeline.ts',
    'lib/platform-v7/deal-workspace-sidepanel.ts',
    'lib/platform-v7/deal-financial-terms.ts',
  ] as const;

  const forbiddenPatterns = [
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'axios.',
    'http.request',
    'https.request',
    'openai',
    'anthropic',
  ] as const;

  it('all deal workspace source files are present', () => {
    for (const file of dealFiles) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }
  });

  it('contains no live network calls or external API references', () => {
    for (const file of dealFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not contain "${pattern}"`).not.toContain(pattern);
      }
    }
  });
});
