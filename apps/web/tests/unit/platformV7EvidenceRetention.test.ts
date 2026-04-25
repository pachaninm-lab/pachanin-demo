import { describe, expect, it } from 'vitest';
import type { PlatformV7AuditTrailEvent } from '@/lib/platform-v7/audit-trail';
import type { PlatformV7EvidenceLedgerEntry } from '@/lib/platform-v7/evidence-ledger';
import {
  platformV7EvidenceRetentionBlockers,
  platformV7EvidenceRetentionCanPurge,
  platformV7EvidenceRetentionDaysUntilExpiry,
  platformV7EvidenceRetentionModel,
  platformV7EvidenceRetentionNextAction,
  platformV7EvidenceRetentionStatus,
  platformV7EvidenceRetentionTone,
} from '@/lib/platform-v7/evidence-retention';

const evidence: PlatformV7EvidenceLedgerEntry = {
  id: 'EV-1',
  entityId: 'DL-1',
  entityType: 'deal',
  evidenceClass: 'contract',
  source: 'edo',
  status: 'anchored',
  hash: 'hash-1',
  signedAt: '2026-04-25T10:00:00.000Z',
  signedBy: 'seller-signature',
  title: 'Договор поставки',
};

const audit: PlatformV7AuditTrailEvent = {
  id: 'AUD-1',
  entityId: 'DL-1',
  entityType: 'deal',
  action: 'created',
  source: 'web_app',
  result: 'success',
  actorId: 'USR-1',
  actorRole: 'seller',
  occurredAt: '2026-04-25T10:05:00.000Z',
  correlationId: 'COR-1',
};

describe('platform-v7 evidence retention', () => {
  it('marks retention active when archive is not near expiry', () => {
    const model = platformV7EvidenceRetentionModel({
      entityId: 'DL-1',
      purpose: 'standard_archive',
      evidenceEntries: [evidence],
      auditEvents: [audit],
      retainedUntil: '2026-07-25T10:00:00.000Z',
      checkedAt: '2026-04-25T10:00:00.000Z',
      legalHold: false,
      disputeOpen: false,
    });

    expect(model.status).toBe('active');
    expect(model.tone).toBe('success');
    expect(model.canPurge).toBe(false);
    expect(model.daysUntilExpiry).toBe(91);
  });

  it('marks retention expiring within 30 days', () => {
    const model = platformV7EvidenceRetentionModel({
      entityId: 'DL-1',
      purpose: 'bank_review',
      evidenceEntries: [evidence],
      auditEvents: [audit],
      retainedUntil: '2026-05-20T10:00:00.000Z',
      checkedAt: '2026-04-25T10:00:00.000Z',
      legalHold: false,
      disputeOpen: false,
    });

    expect(model.status).toBe('expiring');
    expect(model.tone).toBe('warning');
    expect(model.nextAction).toBe('Продлить retention или подтвердить архивирование.');
  });

  it('keeps legal hold from purge even after expiry', () => {
    const model = platformV7EvidenceRetentionModel({
      entityId: 'DL-1',
      purpose: 'dispute_hold',
      evidenceEntries: [evidence],
      auditEvents: [audit],
      retainedUntil: '2026-04-01T10:00:00.000Z',
      checkedAt: '2026-04-25T10:00:00.000Z',
      legalHold: true,
      disputeOpen: true,
    });

    expect(model.status).toBe('legal_hold');
    expect(model.canPurge).toBe(false);
    expect(model.tone).toBe('warning');
  });

  it('allows purge only after expiry without dispute or hold', () => {
    const model = platformV7EvidenceRetentionModel({
      entityId: 'DL-1',
      purpose: 'standard_archive',
      evidenceEntries: [evidence],
      auditEvents: [audit],
      retainedUntil: '2026-04-01T10:00:00.000Z',
      checkedAt: '2026-04-25T10:00:00.000Z',
      legalHold: false,
      disputeOpen: false,
    });

    expect(model.status).toBe('expired');
    expect(model.canPurge).toBe(true);
  });

  it('keeps helper outputs deterministic', () => {
    const input = {
      entityId: 'DL-1',
      purpose: 'standard_archive' as const,
      evidenceEntries: [evidence],
      auditEvents: [audit],
      retainedUntil: '2026-07-25T10:00:00.000Z',
      checkedAt: '2026-04-25T10:00:00.000Z',
      legalHold: false,
      disputeOpen: false,
    };

    expect(platformV7EvidenceRetentionBlockers(input)).toEqual([]);
    expect(platformV7EvidenceRetentionDaysUntilExpiry(input.retainedUntil, input.checkedAt)).toBe(91);
    expect(platformV7EvidenceRetentionStatus({ legalHold: false }, 10, [])).toBe('expiring');
    expect(platformV7EvidenceRetentionCanPurge('expired', { legalHold: false, disputeOpen: false }, [])).toBe(true);
    expect(platformV7EvidenceRetentionTone('expired')).toBe('danger');
    expect(platformV7EvidenceRetentionNextAction('active', [])).toBe('Evidence retention активен.');
  });
});
