import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

const SECURITY_FILES = [
  'lib/platform-v7/anti-leak-filter.ts',
  'lib/platform-v7/bypass-risk-score.ts',
  'lib/platform-v7/audit-events.ts',
  'lib/platform-v7/contact-vault.ts',
  'lib/platform-v7/document-access-control.ts',
  'lib/platform-v7/document-fingerprinting.ts',
];

describe('PR 16.0 — Risk & Document Security Layer — source guard', () => {
  for (const file of SECURITY_FILES) {
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
// anti-leak-filter
// ──────────────────────────────────────────────
import { scanMessageForLeaks } from '@/lib/platform-v7/anti-leak-filter';

describe('scanMessageForLeaks', () => {
  it('returns allow + empty findings for clean text', () => {
    const result = scanMessageForLeaks('Отличное предложение по зерну');
    expect(result.action).toBe('allow');
    expect(result.findings).toHaveLength(0);
    expect(result.safeText).toBe('Отличное предложение по зерну');
  });

  it('detects phone number → high risk → operator_review action', () => {
    const result = scanMessageForLeaks('Позвоните мне: +7 916 123-45-67');
    const phone = result.findings.find((f) => f.type === 'phone');
    expect(phone).toBeDefined();
    expect(phone?.riskLevel).toBe('high');
    expect(result.action).toBe('operator_review');
    expect(result.safeText).toContain('[телефон скрыт]');
    expect(result.safeText).not.toMatch(/\+7 916/);
  });

  it('detects email → high risk', () => {
    const result = scanMessageForLeaks('Напишите мне: user@example.com для деталей');
    const email = result.findings.find((f) => f.type === 'email');
    expect(email).toBeDefined();
    expect(email?.riskLevel).toBe('high');
    expect(result.safeText).toContain('[email скрыт]');
  });

  it('detects bypass_phrase → critical risk → assisted_mode action', () => {
    const result = scanMessageForLeaks('давайте без платформы договоримся напрямую');
    const bypass = result.findings.find((f) => f.type === 'bypass_phrase');
    expect(bypass).toBeDefined();
    expect(bypass?.riskLevel).toBe('critical');
    expect(result.action).toBe('assisted_mode');
  });

  it('detects external_link → medium risk → block action if no higher risk', () => {
    const result = scanMessageForLeaks('Посмотрите тут: https://example.com/docs');
    const link = result.findings.find((f) => f.type === 'external_link');
    expect(link).toBeDefined();
    expect(link?.riskLevel).toBe('medium');
    expect(result.safeText).toContain('[ссылка скрыта]');
  });

  it('detects messenger handle → high risk', () => {
    const result = scanMessageForLeaks('Пиши в telegram @grain_seller_pro');
    expect(result.findings.some((f) => f.type === 'messenger')).toBe(true);
    expect(result.action).toBe('operator_review');
  });

  it('uses max action across multiple findings', () => {
    const result = scanMessageForLeaks('email: test@mail.ru и без платформы договоримся');
    expect(result.action).toBe('assisted_mode');
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
  });

  it('provides rawValueMasked with stars for each finding', () => {
    const result = scanMessageForLeaks('+7 999 888-77-66');
    expect(result.findings[0].rawValueMasked).toMatch(/\*{3}/);
  });

  it('safeText does not contain original sensitive value', () => {
    const result = scanMessageForLeaks('Мой ИНН: 7701234567 для договора');
    expect(result.safeText).toContain('[реквизит скрыт]');
    expect(result.safeText).not.toContain('7701234567');
  });
});

// ──────────────────────────────────────────────
// bypass-risk-score
// ──────────────────────────────────────────────
import {
  riskLevelFromBypassScore,
  mapLeakFindingToSignal,
  calculateBypassRiskProfile,
  platformTrustScoreFromBypassRisk,
  type BypassSignal,
  type BypassRestriction,
} from '@/lib/platform-v7/bypass-risk-score';
import type { AntiLeakFinding } from '@/lib/platform-v7/anti-leak-filter';

describe('riskLevelFromBypassScore', () => {
  it('returns low for score < 35', () => {
    expect(riskLevelFromBypassScore(0)).toBe('low');
    expect(riskLevelFromBypassScore(34)).toBe('low');
  });
  it('returns medium for score 35-59', () => {
    expect(riskLevelFromBypassScore(35)).toBe('medium');
    expect(riskLevelFromBypassScore(59)).toBe('medium');
  });
  it('returns high for score 60-79', () => {
    expect(riskLevelFromBypassScore(60)).toBe('high');
    expect(riskLevelFromBypassScore(79)).toBe('high');
  });
  it('returns critical for score >= 80', () => {
    expect(riskLevelFromBypassScore(80)).toBe('critical');
    expect(riskLevelFromBypassScore(100)).toBe('critical');
  });
});

describe('mapLeakFindingToSignal', () => {
  const makeFinding = (type: AntiLeakFinding['type'], riskLevel: AntiLeakFinding['riskLevel']): AntiLeakFinding => ({
    type,
    riskLevel,
    rawValueMasked: '79***66',
    message: 'test message',
  });

  it('maps phone finding → phone_in_message signal', () => {
    const signal = mapLeakFindingToSignal(makeFinding('phone', 'high'), 'A1', 'seller', 'B1');
    expect(signal.signalType).toBe('phone_in_message');
    expect(signal.actorId).toBe('A1');
    expect(signal.actorRole).toBe('seller');
    expect(signal.counterpartyId).toBe('B1');
    expect(signal.source).toBe('chat');
    expect(signal.riskLevel).toBe('high');
  });

  it('maps email finding → email_in_message signal', () => {
    const signal = mapLeakFindingToSignal(makeFinding('email', 'high'), 'A1', 'buyer');
    expect(signal.signalType).toBe('email_in_message');
  });

  it('maps messenger finding → messenger_handle_in_message signal', () => {
    const signal = mapLeakFindingToSignal(makeFinding('messenger', 'high'), 'A1', 'buyer');
    expect(signal.signalType).toBe('messenger_handle_in_message');
  });

  it('maps external_link finding → external_link_in_message signal', () => {
    const signal = mapLeakFindingToSignal(makeFinding('external_link', 'medium'), 'A1', 'operator');
    expect(signal.signalType).toBe('external_link_in_message');
  });

  it('maps inn finding → inn_exchange_attempt signal', () => {
    const signal = mapLeakFindingToSignal(makeFinding('inn', 'medium'), 'A1', 'seller');
    expect(signal.signalType).toBe('inn_exchange_attempt');
  });

  it('maps exact_address finding → exact_address_request signal', () => {
    const signal = mapLeakFindingToSignal(makeFinding('exact_address', 'medium'), 'A1', 'seller');
    expect(signal.signalType).toBe('exact_address_request');
  });

  it('maps bypass_phrase finding → operator_manual_flag signal', () => {
    const signal = mapLeakFindingToSignal(makeFinding('bypass_phrase', 'critical'), 'A1', 'seller');
    expect(signal.signalType).toBe('operator_manual_flag');
    expect(signal.riskLevel).toBe('critical');
  });

  it('signal has id starting with BYP-', () => {
    const signal = mapLeakFindingToSignal(makeFinding('phone', 'high'), 'X1', 'seller');
    expect(signal.id).toMatch(/^BYP-/);
  });
});

describe('calculateBypassRiskProfile', () => {
  const makeSignal = (riskLevel: BypassSignal['riskLevel'], signalType: BypassSignal['signalType'] = 'phone_in_message'): BypassSignal => ({
    id: `SIG-${signalType}`,
    actorId: 'A1',
    actorRole: 'seller',
    signalType,
    riskLevel,
    source: 'chat',
    description: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  it('returns low risk with no signals', () => {
    const profile = calculateBypassRiskProfile('CP1', []);
    expect(profile.riskLevel).toBe('low');
    expect(profile.totalScore).toBe(0);
    expect(profile.manualReviewRequired).toBe(false);
    expect(profile.restrictions).toHaveLength(0);
  });

  it('accumulates score from signal risk weights', () => {
    const profile = calculateBypassRiskProfile('CP1', [makeSignal('low')]);
    expect(profile.totalScore).toBeGreaterThan(0);
    expect(profile.totalScore).toBeLessThan(100);
  });

  it('high risk adds zero_direct_contact and document_preview_only restrictions', () => {
    const signals = [makeSignal('high'), makeSignal('high'), makeSignal('high')];
    const profile = calculateBypassRiskProfile('CP1', signals);
    expect(profile.riskLevel).toBeOneOf(['high', 'critical']);
    const types = profile.restrictions.map((r) => r.type);
    expect(types).toContain('zero_direct_contact');
    expect(types).toContain('document_preview_only');
  });

  it('deal_cancelled_after_contact_reveal adds cooldown restriction', () => {
    const signal = makeSignal('medium', 'deal_cancelled_after_contact_reveal');
    const profile = calculateBypassRiskProfile('CP1', [signal]);
    expect(profile.restrictions.some((r) => r.type === 'cooldown')).toBe(true);
  });

  it('sets manualReviewRequired when totalScore >= 35', () => {
    const signals = [makeSignal('medium'), makeSignal('medium')];
    const profile = calculateBypassRiskProfile('CP1', signals);
    if (profile.totalScore >= 35) {
      expect(profile.manualReviewRequired).toBe(true);
    }
  });

  it('preserves existing restrictions', () => {
    const existing: BypassRestriction[] = [
      { id: 'RST-existing', type: 'manual_review', reason: 'pre-existing', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const profile = calculateBypassRiskProfile('CP1', [], existing);
    expect(profile.restrictions.some((r) => r.id === 'RST-existing')).toBe(true);
  });

  it('sets lastSignalAt from last signal', () => {
    const signal = makeSignal('low');
    const profile = calculateBypassRiskProfile('CP1', [signal]);
    expect(profile.lastSignalAt).toBe(signal.createdAt);
  });

  it('sets counterpartyId correctly', () => {
    const profile = calculateBypassRiskProfile('CP-999', []);
    expect(profile.counterpartyId).toBe('CP-999');
  });

  it('totalScore is clamped between 0 and 100', () => {
    const signals = Array.from({ length: 20 }, () => makeSignal('critical'));
    const profile = calculateBypassRiskProfile('CP1', signals);
    expect(profile.totalScore).toBeGreaterThanOrEqual(0);
    expect(profile.totalScore).toBeLessThanOrEqual(100);
  });
});

describe('platformTrustScoreFromBypassRisk', () => {
  it('returns 100 when bypass score is 0', () => {
    expect(platformTrustScoreFromBypassRisk(0)).toBe(100);
  });
  it('returns 0 when bypass score is 100', () => {
    expect(platformTrustScoreFromBypassRisk(100)).toBe(0);
  });
  it('inverts the score', () => {
    expect(platformTrustScoreFromBypassRisk(30)).toBe(70);
    expect(platformTrustScoreFromBypassRisk(75)).toBe(25);
  });
  it('clamps to 0-100 range', () => {
    expect(platformTrustScoreFromBypassRisk(110)).toBe(0);
  });
});

// ──────────────────────────────────────────────
// audit-events
// ──────────────────────────────────────────────
import { createAuditEvent, requireReason, withAudit } from '@/lib/platform-v7/audit-events';
import type { AuditInput } from '@/lib/platform-v7/audit-events';

const makeAuditInput = (overrides: Partial<AuditInput> = {}): AuditInput => ({
  entityType: 'deal',
  entityId: 'DEAL-001',
  actorRole: 'seller',
  actorId: 'USR-001',
  action: 'update_status',
  ...overrides,
});

describe('createAuditEvent', () => {
  it('creates event with required fields', () => {
    const event = createAuditEvent(makeAuditInput());
    expect(event.entityType).toBe('deal');
    expect(event.entityId).toBe('DEAL-001');
    expect(event.actorRole).toBe('seller');
    expect(event.actorId).toBe('USR-001');
    expect(event.action).toBe('update_status');
    expect(event.createdAt).toBeTruthy();
    expect(event.id).toBeTruthy();
  });

  it('includes optional dealId when provided', () => {
    const event = createAuditEvent(makeAuditInput({ dealId: 'D-42' }));
    expect(event.dealId).toBe('D-42');
  });

  it('includes optional reason when provided', () => {
    const event = createAuditEvent(makeAuditInput({ reason: 'test reason' }));
    expect(event.reason).toBe('test reason');
  });

  it('includes before and after snapshots', () => {
    const event = createAuditEvent(makeAuditInput({ before: { status: 'draft' }, after: { status: 'active' } }));
    expect(event.before).toEqual({ status: 'draft' });
    expect(event.after).toEqual({ status: 'active' });
  });

  it('generates unique ids for distinct events', () => {
    const e1 = createAuditEvent(makeAuditInput());
    const e2 = createAuditEvent(makeAuditInput({ entityId: 'DEAL-002' }));
    expect(e1.id).not.toBe(e2.id);
  });
});

describe('requireReason', () => {
  const reasonRequiredActions = ['reject_offer', 'cancel_deal_draft', 'override_risk', 'reveal_contact', 'hide_review'];

  for (const action of reasonRequiredActions) {
    it(`throws when action "${action}" has no reason`, () => {
      expect(() => requireReason(action)).toThrow();
      expect(() => requireReason(action, '')).toThrow();
      expect(() => requireReason(action, '   ')).toThrow();
    });
    it(`does not throw when action "${action}" has a reason`, () => {
      expect(() => requireReason(action, 'valid reason')).not.toThrow();
    });
  }

  it('does not throw for non-reason-required actions', () => {
    expect(() => requireReason('update_status')).not.toThrow();
    expect(() => requireReason('view_deal')).not.toThrow();
  });
});

describe('withAudit', () => {
  it('returns result and auditEvent', () => {
    const payload = { status: 'approved' };
    const { result, auditEvent } = withAudit(makeAuditInput({ action: 'update_status' }), payload);
    expect(result).toEqual(payload);
    expect(auditEvent.action).toBe('update_status');
  });

  it('throws when reason-required action has no reason', () => {
    expect(() => withAudit(makeAuditInput({ action: 'reject_offer' }), {})).toThrow();
  });

  it('succeeds when reason-required action has reason', () => {
    const { result } = withAudit(makeAuditInput({ action: 'reject_offer', reason: 'price too low' }), { ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('sets after field from passed value', () => {
    const { auditEvent } = withAudit(makeAuditInput({ action: 'update_status' }), { next: 'done' });
    expect(auditEvent.after).toEqual({ next: 'done' });
  });
});

// ──────────────────────────────────────────────
// contact-vault
// ──────────────────────────────────────────────
import { canRevealContact, revealContact } from '@/lib/platform-v7/contact-vault';
import type { ContactVaultEntry, ContactRevealContext } from '@/lib/platform-v7/contact-vault';

const makeEntry = (overrides: Partial<ContactVaultEntry> = {}): ContactVaultEntry => ({
  id: 'CVE-001',
  counterpartyId: 'CP-001',
  contactType: 'phone',
  encryptedValue: 'enc::+7999***1234',
  revealPolicy: {
    minStage: 'deal_draft',
    allowedRoles: ['seller', 'buyer', 'operator'],
    requireOperatorApproval: false,
    blockIfBypassRiskAbove: 60,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeCtx = (overrides: Partial<ContactRevealContext> = {}): ContactRevealContext => ({
  role: 'seller',
  stage: 'deal_draft',
  actorId: 'USR-001',
  ...overrides,
});

describe('canRevealContact', () => {
  it('returns allowed: true when all conditions met', () => {
    const result = canRevealContact(makeEntry(), makeCtx());
    expect(result.allowed).toBe(true);
  });

  it('returns not allowed when role is not in allowedRoles', () => {
    const result = canRevealContact(makeEntry(), makeCtx({ role: 'driver' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('role_not_allowed');
  });

  it('returns not allowed when stage is too early', () => {
    const result = canRevealContact(makeEntry(), makeCtx({ stage: 'interest' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('stage_too_early');
  });

  it('returns not allowed when bypass risk is too high', () => {
    const result = canRevealContact(makeEntry(), makeCtx({
      bypassRiskProfile: {
        counterpartyId: 'CP-001',
        totalScore: 75,
        riskLevel: 'high',
        signals: [],
        restrictions: [],
        manualReviewRequired: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('bypass_risk_too_high');
  });

  it('returns not allowed when operator approval required but not given', () => {
    const entry = makeEntry({ revealPolicy: { ...makeEntry().revealPolicy, requireOperatorApproval: true } });
    const result = canRevealContact(entry, makeCtx({ operatorApproved: false }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('operator_approval_required');
  });

  it('returns allowed when operator approval required and given', () => {
    const entry = makeEntry({ revealPolicy: { ...makeEntry().revealPolicy, requireOperatorApproval: true } });
    const result = canRevealContact(entry, makeCtx({ operatorApproved: true }));
    expect(result.allowed).toBe(true);
  });
});

describe('revealContact', () => {
  it('returns maskedValue and auditEvent when allowed', () => {
    const { maskedValue, auditEvent } = revealContact(makeEntry(), makeCtx());
    expect(maskedValue).toBe('enc::+7999***1234');
    expect(auditEvent.action).toBe('contact_revealed');
    expect(auditEvent.entityType).toBe('contact_vault');
  });

  it('throws when reveal is denied', () => {
    expect(() => revealContact(makeEntry(), makeCtx({ role: 'driver' }))).toThrow('Contact reveal denied');
  });

  it('throws with reason in message when denied', () => {
    expect(() => revealContact(makeEntry(), makeCtx({ stage: 'interest' }))).toThrow('stage_too_early');
  });
});

// ──────────────────────────────────────────────
// document-access-control
// ──────────────────────────────────────────────
import { canPreviewDocument, canDownloadDocument, documentAccessLabel } from '@/lib/platform-v7/document-access-control';
import type { DocumentAccessContext } from '@/lib/platform-v7/document-access-control';

const makeDocCtx = (overrides: Partial<DocumentAccessContext> = {}): DocumentAccessContext => ({
  role: 'seller',
  hasDealDraft: true,
  hasAcceptedOffer: false,
  maturity: 'controlled-pilot',
  ...overrides,
});

describe('canPreviewDocument', () => {
  it('returns false for driver role', () => {
    expect(canPreviewDocument(makeDocCtx({ role: 'driver' }))).toBe(false);
  });

  it('returns false when bypass score >= 80', () => {
    expect(canPreviewDocument(makeDocCtx({
      bypassRiskProfile: {
        counterpartyId: 'CP', totalScore: 80, riskLevel: 'critical',
        signals: [], restrictions: [], manualReviewRequired: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }))).toBe(false);
  });

  it('returns true when has deal draft', () => {
    expect(canPreviewDocument(makeDocCtx({ hasDealDraft: true }))).toBe(true);
  });

  it('returns true when has accepted offer', () => {
    expect(canPreviewDocument(makeDocCtx({ hasDealDraft: false, hasAcceptedOffer: true }))).toBe(true);
  });

  it('returns true when operator approved', () => {
    expect(canPreviewDocument(makeDocCtx({ hasDealDraft: false, hasAcceptedOffer: false, operatorApproved: true }))).toBe(true);
  });

  it('returns false when none of the conditions are met', () => {
    expect(canPreviewDocument(makeDocCtx({ hasDealDraft: false, hasAcceptedOffer: false }))).toBe(false);
  });
});

describe('canDownloadDocument', () => {
  it('returns not allowed for driver', () => {
    const result = canDownloadDocument(makeDocCtx({ role: 'driver' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('role_not_allowed');
  });

  it('returns not allowed for investor', () => {
    const result = canDownloadDocument(makeDocCtx({ role: 'investor' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('role_not_allowed');
  });

  it('returns not allowed when no deal draft', () => {
    const result = canDownloadDocument(makeDocCtx({ hasDealDraft: false }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('deal_draft_required');
  });

  it('returns not allowed when bypass risk >= 35 without operator approval', () => {
    const result = canDownloadDocument(makeDocCtx({
      bypassRiskProfile: {
        counterpartyId: 'CP', totalScore: 40, riskLevel: 'medium',
        signals: [], restrictions: [], manualReviewRequired: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('operator_approval_required');
  });

  it('returns allowed when bypass risk >= 35 with operator approval', () => {
    const result = canDownloadDocument(makeDocCtx({
      operatorApproved: true,
      bypassRiskProfile: {
        counterpartyId: 'CP', totalScore: 40, riskLevel: 'medium',
        signals: [], restrictions: [], manualReviewRequired: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }));
    expect(result.allowed).toBe(true);
  });

  it('returns allowed for seller with deal draft and no risk', () => {
    const result = canDownloadDocument(makeDocCtx());
    expect(result.allowed).toBe(true);
  });
});

describe('documentAccessLabel', () => {
  it('returns download label when download is allowed', () => {
    const label = documentAccessLabel(makeDocCtx());
    expect(label).toContain('скачивание');
  });

  it('returns preview label when only preview is allowed', () => {
    const label = documentAccessLabel(makeDocCtx({
      role: 'bank',
      hasDealDraft: false,
      hasAcceptedOffer: true,
    }));
    expect(label).toContain('preview');
  });

  it('returns closed label when neither preview nor download allowed', () => {
    const label = documentAccessLabel(makeDocCtx({ role: 'driver' }));
    expect(label).toContain('закрыто');
  });
});

// ──────────────────────────────────────────────
// document-fingerprinting
// ──────────────────────────────────────────────
import { createDocumentFingerprint, auditDocumentAccess } from '@/lib/platform-v7/document-fingerprinting';
import type { DocumentFingerprintInput } from '@/lib/platform-v7/document-fingerprinting';

const makeFpInput = (overrides: Partial<DocumentFingerprintInput> = {}): DocumentFingerprintInput => ({
  fileId: 'FILE-001',
  userId: 'USR-001',
  accessLevel: 'preview',
  fileHash: 'abc123def456',
  openedAt: '2026-01-01T12:00:00.000Z',
  ...overrides,
});

describe('createDocumentFingerprint', () => {
  it('creates fingerprint with all fields', () => {
    const fp = createDocumentFingerprint(makeFpInput());
    expect(fp.visibleWatermark).toBeTruthy();
    expect(fp.invisibleFingerprint).toBeTruthy();
    expect(fp.fileHash).toBe('abc123def456');
    expect(fp.openedAt).toBe('2026-01-01T12:00:00.000Z');
  });

  it('uses dealId in watermark scope', () => {
    const fp = createDocumentFingerprint(makeFpInput({ dealId: 'DEAL-42' }));
    expect(fp.visibleWatermark).toContain('DEAL-42');
  });

  it('uses lotId in scope when no dealId', () => {
    const fp = createDocumentFingerprint(makeFpInput({ lotId: 'LOT-77' }));
    expect(fp.visibleWatermark).toContain('LOT-77');
  });

  it('uses rfqId in scope when no dealId or lotId', () => {
    const fp = createDocumentFingerprint(makeFpInput({ rfqId: 'RFQ-99' }));
    expect(fp.visibleWatermark).toContain('RFQ-99');
  });

  it('uses NO-SCOPE when no deal/lot/rfq provided', () => {
    const fp = createDocumentFingerprint(makeFpInput());
    expect(fp.visibleWatermark).toContain('NO-SCOPE');
  });

  it('includes userId in watermark', () => {
    const fp = createDocumentFingerprint(makeFpInput());
    expect(fp.visibleWatermark).toContain('USR-001');
  });

  it('includes accessLevel in watermark', () => {
    const fp = createDocumentFingerprint(makeFpInput({ accessLevel: 'download' }));
    expect(fp.visibleWatermark).toContain('download');
  });

  it('generates invisibleFingerprint as base64', () => {
    const fp = createDocumentFingerprint(makeFpInput());
    expect(() => Buffer.from(fp.invisibleFingerprint, 'base64').toString('utf8')).not.toThrow();
    const decoded = Buffer.from(fp.invisibleFingerprint, 'base64').toString('utf8');
    expect(decoded).toContain('FILE-001');
    expect(decoded).toContain('USR-001');
  });

  it('uses current time when openedAt not provided', () => {
    const before = Date.now();
    const fp = createDocumentFingerprint(makeFpInput({ openedAt: undefined }));
    const after = Date.now();
    expect(new Date(fp.openedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(fp.openedAt).getTime()).toBeLessThanOrEqual(after);
  });
});

describe('auditDocumentAccess', () => {
  it('returns fingerprint and auditEvent', () => {
    const { fingerprint, auditEvent } = auditDocumentAccess(makeFpInput(), 'seller');
    expect(fingerprint.fileHash).toBe('abc123def456');
    expect(auditEvent.entityType).toBe('document');
    expect(auditEvent.entityId).toBe('FILE-001');
    expect(auditEvent.actorId).toBe('USR-001');
    expect(auditEvent.actorRole).toBe('seller');
  });

  it('sets action to document_downloaded for download access', () => {
    const { auditEvent } = auditDocumentAccess(makeFpInput({ accessLevel: 'download' }), 'buyer');
    expect(auditEvent.action).toBe('document_downloaded');
  });

  it('sets action to document_opened for preview access', () => {
    const { auditEvent } = auditDocumentAccess(makeFpInput({ accessLevel: 'preview' }), 'seller');
    expect(auditEvent.action).toBe('document_opened');
  });

  it('sets action to document_opened for full access', () => {
    const { auditEvent } = auditDocumentAccess(makeFpInput({ accessLevel: 'full' }), 'operator');
    expect(auditEvent.action).toBe('document_opened');
  });

  it('includes dealId in auditEvent when provided', () => {
    const { auditEvent } = auditDocumentAccess(makeFpInput({ dealId: 'DEAL-99' }), 'bank');
    expect(auditEvent.dealId).toBe('DEAL-99');
  });

  it('after field includes visibleWatermark and fileHash', () => {
    const { auditEvent } = auditDocumentAccess(makeFpInput(), 'seller');
    const after = auditEvent.after as Record<string, unknown>;
    expect(after.fileHash).toBe('abc123def456');
    expect(typeof after.visibleWatermark).toBe('string');
  });
});
