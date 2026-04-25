import { describe, expect, it } from 'vitest';
import type { PlatformV7AuditTrailEvent } from '@/lib/platform-v7/audit-trail';
import {
  platformV7AuditTrailBlockers,
  platformV7AuditTrailModel,
  platformV7AuditTrailNextAction,
  platformV7AuditTrailStableKey,
  platformV7AuditTrailStatus,
  platformV7AuditTrailSummary,
  platformV7AuditTrailTone,
} from '@/lib/platform-v7/audit-trail';

const created: PlatformV7AuditTrailEvent = {
  id: 'AUD-1',
  entityId: 'DL-1',
  entityType: 'deal',
  action: 'created',
  source: 'web_app',
  result: 'success',
  actorId: 'USR-1',
  actorRole: 'seller',
  occurredAt: '2026-04-25T10:00:00.000Z',
  correlationId: 'COR-1',
};

const statusChanged: PlatformV7AuditTrailEvent = {
  id: 'AUD-2',
  entityId: 'DL-1',
  entityType: 'deal',
  action: 'status_changed',
  source: 'system_worker',
  result: 'success',
  actorId: 'SYS-1',
  actorRole: 'system',
  occurredAt: '2026-04-25T10:05:00.000Z',
  correlationId: 'COR-2',
  beforeHash: 'hash-before',
  afterHash: 'hash-after',
};

describe('platform-v7 audit trail', () => {
  it('marks complete audit trail as valid and export-ready', () => {
    const model = platformV7AuditTrailModel([statusChanged, created]);

    expect(model.status).toBe('valid');
    expect(model.tone).toBe('success');
    expect(model.canExportAuditPack).toBe(true);
    expect(model.summary.total).toBe(2);
    expect(model.events.map((event) => event.id)).toEqual(['AUD-1', 'AUD-2']);
  });

  it('blocks events without actor or correlation', () => {
    const model = platformV7AuditTrailModel([
      { ...created, actorId: '', correlationId: '' },
    ]);

    expect(model.status).toBe('broken');
    expect(model.tone).toBe('danger');
    expect(model.blockers).toContain('missing-actor:AUD-1');
    expect(model.blockers).toContain('missing-correlation:AUD-1');
  });

  it('keeps failed events in warning when reason is present', () => {
    const model = platformV7AuditTrailModel([
      { ...created, result: 'failure', reason: 'document mismatch' },
    ]);

    expect(model.status).toBe('warning');
    expect(model.canExportAuditPack).toBe(false);
    expect(model.summary.failure).toBe(1);
  });

  it('requires before and after hashes for status changes', () => {
    const model = platformV7AuditTrailModel([
      { ...statusChanged, beforeHash: undefined },
    ]);

    expect(model.status).toBe('warning');
    expect(model.blockers).toContain('missing-status-hash:AUD-2');
  });

  it('keeps helper outputs deterministic', () => {
    expect(platformV7AuditTrailBlockers([created])).toEqual([]);
    expect(platformV7AuditTrailSummary([created]).uniqueActors).toBe(1);
    expect(platformV7AuditTrailStatus([], platformV7AuditTrailSummary([created]))).toBe('valid');
    expect(platformV7AuditTrailTone('broken')).toBe('danger');
    expect(platformV7AuditTrailNextAction('valid', [])).toBe('Audit trail готов к экспорту.');
    expect(platformV7AuditTrailStableKey(created)).toBe('deal:DL-1:created:COR-1');
  });
});
