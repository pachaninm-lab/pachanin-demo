import { describe, expect, it } from 'vitest';

import {
  PLATFORM_V7_AUDIT_READ_MODEL_EVENTS,
  platformV7AssertAuditReadModelDecision,
  platformV7AuditEventsForDeal,
  platformV7AuditReadModelDecision,
  platformV7AuditReadModelViewFor,
} from '../../../src/platform-v7/audit-read-model';

describe('platform-v7 audit read-model boundary', () => {
  it('exposes frozen controlled-pilot audit events without live claims', () => {
    expect(PLATFORM_V7_AUDIT_READ_MODEL_EVENTS).toHaveLength(4);
    expect(Object.isFrozen(PLATFORM_V7_AUDIT_READ_MODEL_EVENTS[0])).toBe(true);
    expect(PLATFORM_V7_AUDIT_READ_MODEL_EVENTS.map((event) => event.source)).toEqual([
      'controlled-pilot-audit-read-model',
      'controlled-pilot-audit-read-model',
      'controlled-pilot-audit-read-model',
      'controlled-pilot-audit-read-model',
    ]);
    expect(PLATFORM_V7_AUDIT_READ_MODEL_EVENTS.map((event) => event.reason).join(' ')).not.toMatch(
      /production-ready|fully live|bank connected|fully integrated|guaranteed payment/i,
    );
  });

  it('builds a deterministic read-only audit view by deal and tenant', () => {
    const view = platformV7AuditReadModelViewFor('DL-9102', 'TENANT-GRAIN-001');

    expect(view).not.toBeNull();
    expect(view?.dealId).toBe('DL-9102');
    expect(view?.tenantId).toBe('TENANT-GRAIN-001');
    expect(view?.events).toHaveLength(4);
    expect(view?.evidenceReferenceCount).toBe(4);
    expect(view?.hasMoneyHold).toBe(true);
    expect(view?.source).toBe('controlled-pilot-audit-read-model');
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view?.events)).toBe(true);
  });

  it('returns null for unknown deal or tenant views', () => {
    expect(platformV7AuditReadModelViewFor('DL-404', 'TENANT-GRAIN-001')).toBeNull();
    expect(platformV7AuditReadModelViewFor('DL-9102', 'TENANT-OTHER')).toBeNull();
  });

  it('keeps audit events target-scoped and timestamped', () => {
    const events = platformV7AuditEventsForDeal('DL-9102');

    expect(events).toHaveLength(4);
    expect(events.every((event) => event.eventId.startsWith('AUDIT-DL-9102-'))).toBe(true);
    expect(events.every((event) => event.target.dealId === 'DL-9102')).toBe(true);
    expect(events.every((event) => event.target.tenantId === 'TENANT-GRAIN-001')).toBe(true);
    expect(events.every((event) => !Number.isNaN(Date.parse(event.occurredAtIso)))).toBe(true);
  });

  it('allows only canonical audit owner roles to read audit events', () => {
    expect(platformV7AuditReadModelDecision('compliance', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'audit-read-model-selected',
    });
    expect(platformV7AuditReadModelDecision('arbitrator', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'audit-read-model-selected',
    });
    expect(platformV7AuditReadModelDecision('operator', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'audit-read-model-selected',
    });
    expect(platformV7AuditReadModelDecision('support', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'audit-read-model-selected',
    });
    expect(platformV7AuditReadModelDecision('executive', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: true,
      reason: 'audit-read-model-selected',
    });
  });

  it('rejects commercial, field and quality roles through canonical audit-entry policy', () => {
    expect(platformV7AuditReadModelDecision('seller', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'canonical-audit-entry-rejected',
    });
    expect(platformV7AuditReadModelDecision('driver', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'canonical-audit-entry-rejected',
    });
    expect(platformV7AuditReadModelDecision('lab', 'DL-9102', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'canonical-audit-entry-rejected',
    });
  });

  it('separates unknown deal from tenant mismatch', () => {
    expect(platformV7AuditReadModelDecision('compliance', 'DL-404', 'TENANT-GRAIN-001')).toMatchObject({
      allowed: false,
      reason: 'deal-mismatch',
    });
    expect(platformV7AuditReadModelDecision('compliance', 'DL-9102', 'TENANT-OTHER')).toMatchObject({
      allowed: false,
      reason: 'tenant-mismatch',
    });
  });

  it('asserts accepted and rejected audit read decisions', () => {
    expect(() => platformV7AssertAuditReadModelDecision('compliance', 'DL-9102', 'TENANT-GRAIN-001')).not.toThrow();
    expect(() => platformV7AssertAuditReadModelDecision('seller', 'DL-9102', 'TENANT-GRAIN-001')).toThrow(
      'canonical-audit-entry-rejected',
    );
  });
});
