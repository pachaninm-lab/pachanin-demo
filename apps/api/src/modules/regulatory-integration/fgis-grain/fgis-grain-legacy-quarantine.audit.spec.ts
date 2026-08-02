import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ForbiddenException, GoneException, ServiceUnavailableException } from '@nestjs/common';
import { IntegrationsService } from '../../integrations/integrations.service';
import { EdoWebhookController } from '../../integrations/edo-webhook.controller';
import { FgisStepService } from '../../saga/fgis-step.service';
import { FgisLegacyQuarantineAuditService } from './fgis-grain-legacy-quarantine.audit';
import { FGIS_LEGACY_ERROR_CODES } from './fgis-grain-legacy-quarantine';
import {
  RecordingFgisQuarantineAudit,
  recordedMaterial,
} from './fgis-grain-legacy-quarantine.test-double';
import type { RequestUser } from '../../../common/types/request-user';

/**
 * Defect 1 regression guard: a denial on a retired ФГИС «Зерно» path is a
 * durable PostgreSQL fact, not a log line.
 */

const REPO_ROOT = resolve(__dirname, '../../../../../..');
const MIGRATION =
  'apps/api/prisma/migrations/20260802150000_fgis_legacy_quarantine_audit/migration.sql';

const staff: RequestUser = {
  id: 'user-staff-1',
  orgId: 'org-platform',
  tenantId: 'tenant-one',
  role: 'SUPPORT_MANAGER',
  email: 'staff@example.test',
  sessionId: 'session-staff-1',
};

function runtimeStub() {
  return {
    integrationHealth: jest.fn().mockReturnValue({ status: 'OK', connectors: [] }),
    appendGpsHeartbeat: jest.fn(),
    reservePrepayment: jest.fn(),
  } as any;
}

async function captured(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error('the retired path must not resolve');
}

describe('retired ФГИС path denials are committed to the audit trail', () => {
  let audit: RecordingFgisQuarantineAudit;

  beforeEach(() => {
    audit = new RecordingFgisQuarantineAudit();
  });

  it('records an audit fact when the mock deal push is denied', async () => {
    const service = new IntegrationsService(runtimeStub(), audit.asService());
    const error = await captured(() => service.pushFgis('DEAL-1', staff));

    expect(error).toBeInstanceOf(GoneException);
    expect(audit.facts).toHaveLength(1);
    expect(audit.last).toMatchObject({
      tenantId: 'tenant-one',
      organizationId: 'org-platform',
      actorUserId: 'user-staff-1',
      actorRole: 'SUPPORT_MANAGER',
      sessionId: 'session-staff-1',
      route: 'POST /integrations/fgis-zerno/deals/DEAL-1/push',
      denialCode: FGIS_LEGACY_ERROR_CODES.PUSH_RETIRED,
    });
    expect(audit.last.correlationId).toMatch(/^FGIS-[0-9A-F]{8}$/);
  });

  it('records an audit fact when a staff saga step is denied', async () => {
    const service = new FgisStepService(audit.asService());
    const error = await captured(() =>
      service.executeFgisRegister(
        {
          dealId: 'DEAL-7',
          culture: 'wheat',
          cropClass: '3',
          volumeTons: 500,
          producerInn: '7707083893',
          regionCode: '68',
          gost: 'ГОСТ 9353-2016',
        },
        staff,
      ),
    );

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(audit.last).toMatchObject({
      actorUserId: 'user-staff-1',
      tenantId: 'tenant-one',
      route: 'POST /saga/deals/DEAL-7/execute/fgis_register',
      denialCode: FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
    });
  });

  it('records an audit fact for the /integrations/fgis/webhook denial', async () => {
    const service = new IntegrationsService(runtimeStub(), audit.asService());
    await captured(() => service.handleFgisWebhook({ status: 'CONFIRMED' }));

    expect(audit.last).toMatchObject({
      route: 'POST /integrations/fgis/webhook',
      denialCode: FGIS_LEGACY_ERROR_CODES.WEBHOOK_RETIRED,
      // Public route: there is no authenticated principal to attribute it to,
      // and inventing one would be worse than recording the absence.
      actorUserId: null,
      tenantId: null,
      organizationId: null,
    });
  });

  it('records an audit fact for the /api/webhooks/fgis denial', async () => {
    const controller = new EdoWebhookController(audit.asService());
    await captured(() => controller.fgisCallback());

    expect(audit.last).toMatchObject({
      route: 'POST /api/webhooks/fgis',
      denialCode: FGIS_LEGACY_ERROR_CODES.WEBHOOK_RETIRED,
    });
  });

  it('scopes the fact to the actor tenant and organization the server resolved', async () => {
    const other: RequestUser = {
      ...staff,
      id: 'user-staff-2',
      tenantId: 'tenant-two',
      orgId: 'org-other',
      sessionId: 'session-staff-2',
    };
    const service = new IntegrationsService(runtimeStub(), audit.asService());

    await captured(() => service.pushFgis('DEAL-1', staff));
    await captured(() => service.pushFgis('DEAL-1', other));

    expect(audit.facts.map((fact) => fact.tenantId)).toEqual(['tenant-one', 'tenant-two']);
    expect(audit.facts.map((fact) => fact.organizationId)).toEqual(['org-platform', 'org-other']);
    // Tenant is taken from the resolved session, never from a request field.
    expect(recordedMaterial(audit)).not.toContain('tenant-from-body');
  });

  it('treats a repeated denial as a separate attempt, not a duplicate', async () => {
    const service = new IntegrationsService(runtimeStub(), audit.asService());
    await captured(() => service.pushFgis('DEAL-1', staff));
    await captured(() => service.pushFgis('DEAL-1', staff));

    expect(audit.facts).toHaveLength(2);
    const [first, second] = audit.facts;
    expect(second.correlationId).not.toBe(first.correlationId);
    expect(second.route).toBe(first.route);
  });

  it('records no request body, header, credential or payload', async () => {
    const service = new IntegrationsService(runtimeStub(), audit.asService());
    await captured(() =>
      service.handleFgisWebhook({
        sdizId: 'SDIZ-SECRET',
        signature: 'sha256=deadbeef',
        token: 'bearer-abc',
        certificate: '-----BEGIN CERTIFICATE-----',
      }),
    );

    const material = recordedMaterial(audit);
    for (const leaked of ['SDIZ-SECRET', 'deadbeef', 'bearer-abc', 'BEGIN CERTIFICATE']) {
      expect(material).not.toContain(leaked);
    }
    // The fact carries exactly the boundary fields and nothing else.
    expect(Object.keys(audit.last).sort()).toEqual(
      [
        'actorRole',
        'actorUserId',
        'correlationId',
        'denialCode',
        'organizationId',
        'route',
        'sessionId',
        'tenantId',
      ].sort(),
    );
  });

  it('fails closed with no business mutation when PostgreSQL is unavailable', async () => {
    audit.unavailable = true;
    const service = new IntegrationsService(runtimeStub(), audit.asService());
    const error = await captured(() => service.pushFgis('DEAL-1', staff));

    // 503, not a quiet 410: an attempt that cannot be recorded must not be
    // answered as if it had been.
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = (error as ServiceUnavailableException).getResponse() as Record<string, unknown>;
    expect(body.code).toBe('FGIS_QUARANTINE_AUDIT_UNAVAILABLE');
    expect(body.stateChanged).toBe(false);
    expect(audit.facts).toHaveLength(0);
  });
});

describe('quarantine audit PostgreSQL authority', () => {
  const migration = readFileSync(resolve(REPO_ROOT, MIGRATION), 'utf8');

  it('makes public.audit_events append-only with a loud trigger', () => {
    // Migration 20260712090000 dropped the no_update/no_delete RULES on this
    // table and pointed at a trigger that lives on auth.audit_events instead,
    // leaving public.audit_events rewritable by the owner.
    expect(migration).toContain('CREATE TRIGGER public_audit_events_append_only');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON public."audit_events"');
    expect(migration).toContain('CREATE TRIGGER public_audit_events_no_truncate');
    expect(migration).toContain('public.audit_events is append-only');
  });

  it('appends the denial through a hash-chained SECURITY DEFINER command', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.record_fgis_legacy_quarantine_denial(',
    );
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog, public');
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('public.audit_events.global-head', 0))");
    expect(migration).toContain('"prevHash"');
  });

  it('stores exactly the boundary fields required by the quarantine', () => {
    for (const field of [
      'p_tenant_id',
      'p_organization_id',
      'p_actor_user_id',
      'p_session_id',
      'p_route',
      'p_denial_code',
      'p_correlation_id',
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain("'LEGACY_FGIS_QUARANTINE'");
    expect(migration).toContain("'DENIED'");
  });

  it('accepts no parameter that could carry a payload or credential', () => {
    const signature = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.record_fgis_legacy_quarantine_denial('),
      migration.indexOf('RETURNS jsonb'),
    );
    for (const forbidden of ['payload', 'body', 'xml', 'header', 'certificate', 'token', 'secret']) {
      expect(signature.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('bounds every stored field so the audit cannot become a payload channel', () => {
    expect(migration).toContain('FGIS_QUARANTINE_AUDIT_FIELD_TOO_LONG');
    expect(migration).toContain('length(p_route) > 400');
  });

  it('revokes the command from PUBLIC and grants it only to app roles', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.record_fgis_legacy_quarantine_denial(');
    expect(migration).toContain("ARRAY['app_deal', 'app_service', 'app_runtime']");
  });
});

describe('FgisLegacyQuarantineAuditService', () => {
  it('fails closed and leaks no driver detail when the insert throws', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(
        new Error('connect ECONNREFUSED postgres://app:hunter2@db:5432/pc'),
      ),
    } as any;
    const service = new FgisLegacyQuarantineAuditService(prisma);

    const error = await captured(() =>
      service.recordDenial({
        tenantId: 'tenant-one',
        organizationId: 'org-one',
        actorUserId: 'user-1',
        actorRole: 'FARMER',
        sessionId: 'session-1',
        route: 'POST /integrations/fgis/webhook',
        denialCode: FGIS_LEGACY_ERROR_CODES.WEBHOOK_RETIRED,
        correlationId: 'FGIS-AABBCCDD',
      }),
    );

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const body = (error as ServiceUnavailableException).getResponse() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    expect(body.correlationCode).toBe('FGIS-AABBCCDD');
  });

  it('rejects a receipt that carries no audit event id', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ result: {} }]) } as any;
    const service = new FgisLegacyQuarantineAuditService(prisma);
    await expect(
      service.recordDenial({
        tenantId: null,
        organizationId: null,
        actorUserId: null,
        actorRole: null,
        sessionId: null,
        route: 'POST /api/webhooks/fgis',
        denialCode: FGIS_LEGACY_ERROR_CODES.WEBHOOK_RETIRED,
        correlationId: 'FGIS-11223344',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
