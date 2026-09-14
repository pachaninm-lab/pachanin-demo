import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RequestUser } from '../../common/types/request-user';
import {
  ORGANIZATION_CAPABILITY_CODES,
  ORGANIZATION_CAPABILITY_REGISTRY,
} from './organization-capability.registry';
import {
  OrganizationCapabilityRepository,
  stableJson,
} from './organization-capability.repository';
import { OrganizationCapabilityService } from './organization-capability.service';

const EXPECTED_CODES = [
  'SELL_CROP',
  'BUY_CROP',
  'OWN_TRANSPORT',
  'PROVIDE_LOGISTICS',
  'PROVIDE_EXPEDITION',
  'STORE_CROP',
  'PROVIDE_ELEVATOR_SERVICES',
  'PROVIDE_LAB_TESTING',
  'PROVIDE_SURVEYING',
  'PROVIDE_FINANCING',
  'PROVIDE_INSURANCE',
  'ACCOUNTING_INTEGRATION',
  'API_INTEGRATION',
] as const;

describe('PC-CROP W1-A Organization Capability Authority', () => {
  it('keeps the final specification registry closed to exactly 13 canonical codes', () => {
    expect(ORGANIZATION_CAPABILITY_CODES).toEqual(EXPECTED_CODES);
    expect(new Set(ORGANIZATION_CAPABILITY_CODES).size).toBe(13);
    expect(Object.keys(ORGANIZATION_CAPABILITY_REGISTRY).sort()).toEqual([...EXPECTED_CODES].sort());
  });

  it('keeps regulated/provider capabilities fail-closed behind server-held evidence', () => {
    expect(ORGANIZATION_CAPABILITY_REGISTRY.SELL_CROP.evidencePolicy).toEqual({
      kind: 'ROLE_ELIGIBILITY',
      requestedRole: 'FARMER',
    });
    expect(ORGANIZATION_CAPABILITY_REGISTRY.PROVIDE_ELEVATOR_SERVICES.evidencePolicy).toEqual({
      kind: 'ROLE_ELIGIBILITY',
      requestedRole: 'ELEVATOR',
    });
    expect(ORGANIZATION_CAPABILITY_REGISTRY.PROVIDE_LAB_TESTING.evidencePolicy).toEqual({
      kind: 'ROLE_ELIGIBILITY',
      requestedRole: 'LAB',
    });
    expect(ORGANIZATION_CAPABILITY_REGISTRY.PROVIDE_FINANCING.evidencePolicy).toEqual({
      kind: 'ROLE_ELIGIBILITY',
      requestedRole: 'ACCOUNTING',
    });
    expect(ORGANIZATION_CAPABILITY_REGISTRY.PROVIDE_INSURANCE.evidencePolicy).toEqual({
      kind: 'SERVER_EVIDENCE_REQUIRED',
    });
  });

  it('keeps self-declared operating choices separate from independent verification', () => {
    for (const code of ['OWN_TRANSPORT', 'STORE_CROP', 'ACCOUNTING_INTEGRATION', 'API_INTEGRATION'] as const) {
      expect(ORGANIZATION_CAPABILITY_REGISTRY[code].evidencePolicy).toEqual({ kind: 'DECLARATION_ONLY' });
    }
  });

  it('binds idempotency fingerprints to stable command payloads', () => {
    expect(stableJson({ z: 1, a: { y: 2, x: 3 } })).toBe(
      stableJson({ a: { x: 3, y: 2 }, z: 1 }),
    );
    expect(stableJson({ expectedVersion: '1', intent: 'ENABLE' })).not.toBe(
      stableJson({ expectedVersion: '2', intent: 'ENABLE' }),
    );
  });

  it('normalizes only closed-registry commands before reaching persistence', async () => {
    const mutate = jest.fn().mockResolvedValue({ ok: true });
    const repository = {
      list: jest.fn(),
      mutate,
    } as unknown as OrganizationCapabilityRepository;
    const service = new OrganizationCapabilityService(repository);
    const user = { id: 'user-1' } as RequestUser;

    await service.mutate(
      'OWN_TRANSPORT',
      {
        intent: 'ENABLE',
        expectedVersion: '0',
        idempotencyKey: 'org-cap-idem-0001',
        correlationId: 'org-cap-corr-0001',
      },
      user,
    );

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityCode: 'OWN_TRANSPORT',
        intent: 'ENABLE',
        expectedVersion: 0n,
        idempotencyKey: 'org-cap-idem-0001',
        correlationId: 'org-cap-corr-0001',
      }),
      user,
    );

    expect(() => service.mutate(
      'UNKNOWN_CAPABILITY',
      {
        intent: 'ENABLE',
        expectedVersion: 0,
        idempotencyKey: 'org-cap-idem-0002',
      },
      user,
    )).toThrow(BadRequestException);
  });

  it('installs additive FORCE-RLS authority with no implicit grant/backfill', () => {
    const root = resolve(__dirname, '../../../../..');
    const migration = readFileSync(
      resolve(
        root,
        'apps/api/prisma/migrations/20260904193000_organization_capability_shadow_authority/migration.sql',
      ),
      'utf8',
    );

    for (const table of ['organization_assignments', 'command_receipts']) {
      expect(migration).toContain(`ALTER TABLE capability.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE capability.${table} FORCE ROW LEVEL SECURITY`);
    }
    expect(migration).toContain("current_setting('app.current_tenant_id', true)");
    expect(migration).toContain("current_setting('app.current_org_id', true)");
    expect(migration).toContain('outbox_entries_organization_capability_insert');
    expect(migration).toContain('capability.resolve_server_evidence');
    expect(migration).toContain("verdict.verdict = 'ELIGIBLE'");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+capability\.organization_assignments/i);
    expect(migration).not.toMatch(/(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+auth\.registration_applications/i);
    expect(migration).not.toMatch(/(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+eligibility\.verdicts/i);
  });
});
