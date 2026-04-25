import { describe, expect, it } from 'vitest';
import type { PlatformV7AuditTrailEvent } from '@/lib/platform-v7/audit-trail';
import type { PlatformV7EvidenceLedgerEntry } from '@/lib/platform-v7/evidence-ledger';
import {
  platformV7AuditEvidenceExportBlockers,
  platformV7AuditEvidenceExportModel,
  platformV7AuditEvidenceExportNextAction,
  platformV7AuditEvidenceExportStatus,
  platformV7AuditEvidenceExportTone,
} from '@/lib/platform-v7/audit-evidence-export';

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

describe('platform-v7 audit evidence export', () => {
  it('marks export ready when evidence ledger and audit trail are valid', () => {
    const model = platformV7AuditEvidenceExportModel({
      exportId: 'EXP-1',
      dealId: 'DL-1',
      purpose: 'bank_review',
      evidenceEntries: [evidence],
      auditEvents: [audit],
      createdAt: '2026-04-25T11:00:00.000Z',
      createdBy: 'operator',
    });

    expect(model.status).toBe('ready');
    expect(model.canExport).toBe(true);
    expect(model.tone).toBe('success');
    expect(model.evidenceCount).toBe(1);
    expect(model.auditEventCount).toBe(1);
    expect(model.evidenceKeys).toEqual(['deal:DL-1:contract:hash-1']);
    expect(model.auditKeys).toEqual(['deal:DL-1:created:COR-1']);
  });

  it('marks export incomplete when audit trail is missing', () => {
    const model = platformV7AuditEvidenceExportModel({
      exportId: 'EXP-2',
      dealId: 'DL-1',
      purpose: 'due_diligence',
      evidenceEntries: [evidence],
      auditEvents: [],
      createdAt: '2026-04-25T11:00:00.000Z',
      createdBy: 'operator',
    });

    expect(model.status).toBe('incomplete');
    expect(model.canExport).toBe(false);
    expect(model.blockers).toContain('audit-not-ready');
    expect(model.blockers).toContain('due-diligence-missing-correlations');
  });

  it('blocks export when ledger is broken', () => {
    const model = platformV7AuditEvidenceExportModel({
      exportId: 'EXP-3',
      dealId: 'DL-1',
      purpose: 'dispute',
      evidenceEntries: [{ ...evidence, hash: '' }],
      auditEvents: [audit],
      createdAt: '2026-04-25T11:00:00.000Z',
      createdBy: 'operator',
    });

    expect(model.status).toBe('blocked');
    expect(model.canExport).toBe(false);
    expect(model.blockers).toContain('ledger:missing-hash:EV-1');
  });

  it('keeps helper outputs deterministic', () => {
    const readyModel = platformV7AuditEvidenceExportModel({
      exportId: 'EXP-4',
      dealId: 'DL-1',
      purpose: 'operator_archive',
      evidenceEntries: [evidence],
      auditEvents: [audit],
      createdAt: '2026-04-25T11:00:00.000Z',
      createdBy: 'operator',
    });

    expect(platformV7AuditEvidenceExportBlockers(
      { createdAt: '2026-04-25T11:00:00.000Z', createdBy: 'operator', purpose: 'operator_archive' },
      readyModel.ledger,
      readyModel.auditTrail,
    )).toEqual([]);
    expect(platformV7AuditEvidenceExportStatus([], readyModel.ledger, readyModel.auditTrail)).toBe('ready');
    expect(platformV7AuditEvidenceExportTone('blocked')).toBe('danger');
    expect(platformV7AuditEvidenceExportNextAction('ready', [])).toBe('Audit + evidence export готов.');
  });
});
