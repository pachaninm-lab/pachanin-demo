import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PLATFORM_V7_DEAL_STATUS_ORDER,
  canPlatformV7DealTransition,
  isPlatformV7DealTerminal,
  getPlatformV7DealNextStatuses,
  type PlatformV7DealStatus,
} from '@/lib/platform-v7/deal-state-model';

import {
  isPlatformV7DisputeOpen,
  isPlatformV7DisputeMoneyLinked,
  doesPlatformV7DisputeRequireManualReview,
  canPlatformV7DisputeBeResolved,
  canPlatformV7DisputeChangeMoney,
  type PlatformV7Dispute,
} from '@/lib/platform-v7/dispute-model';

import {
  platformV7DisputeReadiness,
  type PlatformV7DisputeCase,
} from '@/lib/platform-v7/dispute-engine';

import {
  getPlatformV7EvidenceMissingCount,
  isPlatformV7EvidencePackComplete,
  canPlatformV7ResolveFromEvidence,
  isPlatformV7EvidencePackLinked,
  type PlatformV7EvidencePack,
} from '@/lib/platform-v7/evidence-model';

import {
  DEFAULT_DISPUTE_EVIDENCE_REQUIREMENTS,
  validateEvidenceItem,
  validateEvidenceChain,
  buildEvidencePackReadiness,
  lockEvidencePack,
  appendEvidenceItem,
  type P7EvidenceItem,
} from '@/lib/platform-v7/evidence-pack';

describe('deal-state-model — state machine', () => {
  it('STATUS_ORDER has 13 statuses', () => {
    expect(PLATFORM_V7_DEAL_STATUS_ORDER).toHaveLength(13);
  });

  it('STATUS_ORDER starts with draft and ends with cancelled', () => {
    expect(PLATFORM_V7_DEAL_STATUS_ORDER[0]).toBe('draft');
    expect(PLATFORM_V7_DEAL_STATUS_ORDER[PLATFORM_V7_DEAL_STATUS_ORDER.length - 1]).toBe('cancelled');
  });

  it('draft can transition to awaiting_reserve and cancelled', () => {
    expect(canPlatformV7DealTransition('draft', 'awaiting_reserve')).toBe(true);
    expect(canPlatformV7DealTransition('draft', 'cancelled')).toBe(true);
  });

  it('draft cannot skip to money_reserved', () => {
    expect(canPlatformV7DealTransition('draft', 'money_reserved')).toBe(false);
  });

  it('closed and cancelled are terminal', () => {
    expect(isPlatformV7DealTerminal('closed')).toBe(true);
    expect(isPlatformV7DealTerminal('cancelled')).toBe(true);
  });

  it('draft is not terminal', () => {
    expect(isPlatformV7DealTerminal('draft')).toBe(false);
  });

  it('closed has no next statuses', () => {
    expect(getPlatformV7DealNextStatuses('closed')).toHaveLength(0);
  });

  it('dispute can transition to manual_review, awaiting_money_release, closed', () => {
    expect(canPlatformV7DealTransition('dispute', 'manual_review')).toBe(true);
    expect(canPlatformV7DealTransition('dispute', 'awaiting_money_release')).toBe(true);
    expect(canPlatformV7DealTransition('dispute', 'closed')).toBe(true);
  });

  it('in_transit can go to dispute', () => {
    expect(canPlatformV7DealTransition('in_transit', 'dispute')).toBe(true);
  });

  it('manual_review can recover to several statuses', () => {
    const next = getPlatformV7DealNextStatuses('manual_review');
    expect(next).toContain('awaiting_reserve');
    expect(next).toContain('dispute');
    expect(next).toContain('cancelled');
  });

  it('awaiting_money_release can close', () => {
    expect(canPlatformV7DealTransition('awaiting_money_release', 'closed')).toBe(true);
  });

  it('non-terminal statuses have at least one transition', () => {
    const nonTerminal: PlatformV7DealStatus[] = ['draft', 'awaiting_reserve', 'money_reserved', 'awaiting_documents',
      'awaiting_logistics', 'in_transit', 'awaiting_acceptance', 'awaiting_lab', 'awaiting_money_release', 'manual_review', 'dispute'];
    for (const status of nonTerminal) {
      expect(getPlatformV7DealNextStatuses(status).length, status).toBeGreaterThan(0);
    }
  });
});

describe('dispute-model — dispute predicates', () => {
  const makeDispute = (overrides: Partial<PlatformV7Dispute> = {}): PlatformV7Dispute => ({
    id: 'd1' as any,
    dealId: 'deal1' as any,
    reason: 'quality',
    status: 'open',
    heldAmountRub: 50000 as any,
    createdAt: '2024-03-01T00:00:00Z' as any,
    updatedAt: '2024-03-01T00:00:00Z' as any,
    ...overrides,
  });

  it('isPlatformV7DisputeOpen: open status → true', () => {
    expect(isPlatformV7DisputeOpen(makeDispute({ status: 'open' }))).toBe(true);
  });

  it('isPlatformV7DisputeOpen: resolved status → false', () => {
    expect(isPlatformV7DisputeOpen(makeDispute({ status: 'resolved' }))).toBe(false);
  });

  it('isPlatformV7DisputeOpen: closed status → false', () => {
    expect(isPlatformV7DisputeOpen(makeDispute({ status: 'closed' }))).toBe(false);
  });

  it('isPlatformV7DisputeMoneyLinked: positive heldAmount → true', () => {
    expect(isPlatformV7DisputeMoneyLinked(makeDispute({ heldAmountRub: 10000 as any }))).toBe(true);
  });

  it('isPlatformV7DisputeMoneyLinked: zero heldAmount → false', () => {
    expect(isPlatformV7DisputeMoneyLinked(makeDispute({ heldAmountRub: 0 as any }))).toBe(false);
  });

  it('doesPlatformV7DisputeRequireManualReview: manual_review status → true', () => {
    expect(doesPlatformV7DisputeRequireManualReview(makeDispute({ status: 'manual_review' }))).toBe(true);
  });

  it('doesPlatformV7DisputeRequireManualReview: no evidencePackId → true', () => {
    expect(doesPlatformV7DisputeRequireManualReview(makeDispute({ evidencePackId: undefined }))).toBe(true);
  });

  it('doesPlatformV7DisputeRequireManualReview: negative heldAmount → true', () => {
    expect(doesPlatformV7DisputeRequireManualReview(makeDispute({ heldAmountRub: -1 as any, evidencePackId: 'ep1' as any }))).toBe(true);
  });

  it('canPlatformV7DisputeBeResolved: decision_ready + canEvidenceResolve + decision → true', () => {
    const dispute = makeDispute({ status: 'decision_ready', decision: 'release_all' });
    expect(canPlatformV7DisputeBeResolved(dispute, true)).toBe(true);
  });

  it('canPlatformV7DisputeBeResolved: wrong status → false', () => {
    const dispute = makeDispute({ status: 'evidence_collection', decision: 'release_all' });
    expect(canPlatformV7DisputeBeResolved(dispute, true)).toBe(false);
  });

  it('canPlatformV7DisputeBeResolved: canEvidenceResolve false → false', () => {
    const dispute = makeDispute({ status: 'decision_ready', decision: 'release_all' });
    expect(canPlatformV7DisputeBeResolved(dispute, false)).toBe(false);
  });

  it('canPlatformV7DisputeChangeMoney: money-linked with money decision → true', () => {
    const dispute = makeDispute({ heldAmountRub: 5000 as any, decision: 'release_all' });
    expect(canPlatformV7DisputeChangeMoney(dispute)).toBe(true);
  });

  it('canPlatformV7DisputeChangeMoney: no money held → false', () => {
    const dispute = makeDispute({ heldAmountRub: 0 as any, decision: 'release_all' });
    expect(canPlatformV7DisputeChangeMoney(dispute)).toBe(false);
  });

  it('canPlatformV7DisputeChangeMoney: manual_review decision → false', () => {
    const dispute = makeDispute({ heldAmountRub: 5000 as any, decision: 'manual_review' });
    expect(canPlatformV7DisputeChangeMoney(dispute)).toBe(false);
  });
});

describe('dispute-engine — dispute readiness', () => {
  const makeCase = (overrides: Partial<PlatformV7DisputeCase> = {}): PlatformV7DisputeCase => ({
    disputeId: 'disp1',
    dealId: 'deal1',
    type: 'quality',
    status: 'under_review',
    reason: 'Weight mismatch',
    claimAmount: 100000,
    blockedAmount: 50000,
    initiatorRole: 'buyer',
    respondentRole: 'seller',
    evidenceIds: ['e1', 'e2'],
    reviewedEvidenceIds: ['e1', 'e2'],
    deadline: '2024-04-01T00:00:00Z',
    currentOwner: 'compliance',
    ...overrides,
  });

  it('canDecide: under_review + all evidence reviewed → true', () => {
    const readiness = platformV7DisputeReadiness(makeCase());
    expect(readiness.canReview).toBe(true);
    expect(readiness.canDecide).toBe(true);
    expect(readiness.missingEvidenceIds).toHaveLength(0);
  });

  it('canDecide: unreviewed evidence → false', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ reviewedEvidenceIds: ['e1'] }));
    expect(readiness.canDecide).toBe(false);
    expect(readiness.missingEvidenceIds).toContain('e2');
  });

  it('canDecide: no evidence at all → false', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ evidenceIds: [], reviewedEvidenceIds: [] }));
    expect(readiness.canDecide).toBe(false);
  });

  it('moneyHeldAmount is clamped to ≥ 0', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ blockedAmount: -1000 }));
    expect(readiness.moneyHeldAmount).toBe(0);
  });

  it('readyToReleaseAmount: partial_release = claimAmount - blockedAmount', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ decision: 'partial_release', claimAmount: 100000, blockedAmount: 40000 }));
    expect(readiness.readyToReleaseAmount).toBe(60000);
  });

  it('readyToReleaseAmount: release = full claimAmount', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ decision: 'release' }));
    expect(readiness.readyToReleaseAmount).toBe(100000);
  });

  it('readyToReleaseAmount: hold decision = 0', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ decision: 'hold' }));
    expect(readiness.readyToReleaseAmount).toBe(0);
  });

  it('bankBasisRequired: decision_issued without bankBasisDocumentId → true', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ status: 'decision_issued', bankBasisDocumentId: undefined }));
    expect(readiness.bankBasisRequired).toBe(true);
  });

  it('bankBasisRequired: decision_issued with bankBasisDocumentId → false', () => {
    const readiness = platformV7DisputeReadiness(makeCase({ status: 'decision_issued', bankBasisDocumentId: 'doc1' }));
    expect(readiness.bankBasisRequired).toBe(false);
  });

  it('nextAction is a non-empty string', () => {
    const readiness = platformV7DisputeReadiness(makeCase());
    expect(typeof readiness.nextAction).toBe('string');
    expect(readiness.nextAction.length).toBeGreaterThan(0);
  });
});

describe('evidence-model — evidence pack predicates', () => {
  const makePack = (overrides: Partial<PlatformV7EvidencePack> = {}): PlatformV7EvidencePack => ({
    id: 'ep1' as any,
    dealId: 'deal1' as any,
    readinessScore: 100,
    requiredEvidenceTypes: ['photo', 'lab_protocol'],
    receivedEvidenceIds: ['e1', 'e2'] as any[],
    missingEvidenceTypes: [],
    canResolve: true,
    ...overrides,
  });

  it('getPlatformV7EvidenceMissingCount: no missing → 0', () => {
    expect(getPlatformV7EvidenceMissingCount(makePack())).toBe(0);
  });

  it('getPlatformV7EvidenceMissingCount: two missing → 2', () => {
    expect(getPlatformV7EvidenceMissingCount(makePack({ missingEvidenceTypes: ['photo', 'lab_protocol'] }))).toBe(2);
  });

  it('isPlatformV7EvidencePackComplete: all required received → true', () => {
    expect(isPlatformV7EvidencePackComplete(makePack())).toBe(true);
  });

  it('isPlatformV7EvidencePackComplete: missing types → false', () => {
    expect(isPlatformV7EvidencePackComplete(makePack({ missingEvidenceTypes: ['photo'] }))).toBe(false);
  });

  it('isPlatformV7EvidencePackComplete: no required types → false', () => {
    expect(isPlatformV7EvidencePackComplete(makePack({ requiredEvidenceTypes: [] }))).toBe(false);
  });

  it('canPlatformV7ResolveFromEvidence: complete + score≥80 + canResolve → true', () => {
    expect(canPlatformV7ResolveFromEvidence(makePack())).toBe(true);
  });

  it('canPlatformV7ResolveFromEvidence: score < 80 → false', () => {
    expect(canPlatformV7ResolveFromEvidence(makePack({ readinessScore: 79 }))).toBe(false);
  });

  it('canPlatformV7ResolveFromEvidence: canResolve false → false', () => {
    expect(canPlatformV7ResolveFromEvidence(makePack({ canResolve: false }))).toBe(false);
  });

  it('isPlatformV7EvidencePackLinked: valid ids → true', () => {
    expect(isPlatformV7EvidencePackLinked(makePack())).toBe(true);
  });

  it('isPlatformV7EvidencePackLinked: empty dealId → false', () => {
    expect(isPlatformV7EvidencePackLinked(makePack({ dealId: '' as any }))).toBe(false);
  });
});

describe('evidence-pack — validation and readiness', () => {
  const makeItem = (overrides: Partial<P7EvidenceItem> = {}): P7EvidenceItem => ({
    id: 'item1',
    dealId: 'deal1',
    type: 'photo',
    source: 'seller',
    trust: 'platform_verified',
    title: 'Grain photo',
    hash: 'abc123',
    uploadedAt: '2024-03-01T10:00:00Z',
    actor: 'seller',
    version: 1,
    immutable: true,
    ...overrides,
  });

  it('DEFAULT_DISPUTE_EVIDENCE_REQUIREMENTS has required lab_protocol, transport_document, photo', () => {
    const required = DEFAULT_DISPUTE_EVIDENCE_REQUIREMENTS.filter((r) => r.required).map((r) => r.type);
    expect(required).toContain('lab_protocol');
    expect(required).toContain('transport_document');
    expect(required).toContain('photo');
  });

  it('validateEvidenceItem: valid item → no issues', () => {
    expect(validateEvidenceItem(makeItem())).toHaveLength(0);
  });

  it('validateEvidenceItem: empty hash → HASH_MISSING issue', () => {
    const issues = validateEvidenceItem(makeItem({ hash: '' }));
    expect(issues.some((i) => i.code === 'HASH_MISSING')).toBe(true);
  });

  it('validateEvidenceItem: mutable item → IMMUTABILITY_BROKEN issue', () => {
    const issues = validateEvidenceItem(makeItem({ immutable: false }));
    expect(issues.some((i) => i.code === 'IMMUTABILITY_BROKEN')).toBe(true);
  });

  it('validateEvidenceItem: invalid version → VERSION_INVALID issue', () => {
    const issues = validateEvidenceItem(makeItem({ version: 0 }));
    expect(issues.some((i) => i.code === 'VERSION_INVALID')).toBe(true);
  });

  it('validateEvidenceItem: signed trust without signedBy → SIGNATURE_REQUIRED', () => {
    const issues = validateEvidenceItem(makeItem({ trust: 'signed', signedBy: '' }));
    expect(issues.some((i) => i.code === 'SIGNATURE_REQUIRED')).toBe(true);
  });

  it('validateEvidenceItem: signed trust with signedBy → no issue', () => {
    const issues = validateEvidenceItem(makeItem({ trust: 'signed', signedBy: 'notary' }));
    expect(issues.some((i) => i.code === 'SIGNATURE_REQUIRED')).toBe(false);
  });

  it('validateEvidenceChain: chain with valid previousHash → no issues', () => {
    const items = [
      makeItem({ id: 'i1', hash: 'hash1' }),
      makeItem({ id: 'i2', hash: 'hash2', previousHash: 'hash1' }),
    ];
    expect(validateEvidenceChain(items)).toHaveLength(0);
  });

  it('validateEvidenceChain: broken chain → CHAIN_BROKEN issue', () => {
    const items = [
      makeItem({ id: 'i1', hash: 'hash1' }),
      makeItem({ id: 'i2', hash: 'hash2', previousHash: 'missing-hash' }),
    ];
    const issues = validateEvidenceChain(items);
    expect(issues.some((i) => i.code === 'CHAIN_BROKEN')).toBe(true);
  });

  it('buildEvidencePackReadiness: complete required evidence → ready_for_review, score 100', () => {
    const items: P7EvidenceItem[] = [
      makeItem({ id: 'i1', type: 'photo', hash: 'h1' }),
      makeItem({ id: 'i2', type: 'lab_protocol', hash: 'h2' }),
      makeItem({ id: 'i3', type: 'transport_document', hash: 'h3' }),
    ];
    const readiness = buildEvidencePackReadiness(items);
    expect(readiness.status).toBe('ready_for_review');
    expect(readiness.score).toBe(100);
    expect(readiness.issues).toHaveLength(0);
  });

  it('buildEvidencePackReadiness: missing required evidence → incomplete with MISSING_REQUIRED_EVIDENCE', () => {
    const items: P7EvidenceItem[] = [
      makeItem({ id: 'i1', type: 'photo', hash: 'h1' }),
    ];
    const readiness = buildEvidencePackReadiness(items);
    expect(readiness.status).toBe('incomplete');
    expect(readiness.issues.some((i) => i.code === 'MISSING_REQUIRED_EVIDENCE')).toBe(true);
    expect(readiness.score).toBeLessThan(100);
  });

  it('lockEvidencePack sets immutable true on all items', () => {
    const items = [makeItem({ immutable: false }), makeItem({ id: 'i2', immutable: false })];
    const locked = lockEvidencePack(items);
    expect(locked.every((i) => i.immutable)).toBe(true);
  });

  it('appendEvidenceItem adds new item', () => {
    const items = [makeItem({ id: 'i1' })];
    const updated = appendEvidenceItem(items, makeItem({ id: 'i2' }));
    expect(updated).toHaveLength(2);
  });

  it('appendEvidenceItem is idempotent: duplicate id not added', () => {
    const items = [makeItem({ id: 'i1' })];
    const updated = appendEvidenceItem(items, makeItem({ id: 'i1' }));
    expect(updated).toHaveLength(1);
  });
});

describe('source guard: deal state / dispute / evidence files have no live calls', () => {
  const sourceFiles = [
    'lib/platform-v7/deal-state-model.ts',
    'lib/platform-v7/dispute-model.ts',
    'lib/platform-v7/dispute-engine.ts',
    'lib/platform-v7/evidence-model.ts',
    'lib/platform-v7/evidence-pack.ts',
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

  it('all source files are present', () => {
    for (const file of sourceFiles) {
      expect(existsSync(join(process.cwd(), file)), file).toBe(true);
    }
  });

  it('contains no live network calls or external API references', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not contain "${pattern}"`).not.toContain(pattern);
      }
    }
  });
});
