import { ConflictException, HttpException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RateLimitRepository } from '../../src/common/security/rate-limit.repository';
import { RateLimitService } from '../../src/common/security/rate-limit.service';
import { OrganizationIntakeService } from '../../src/modules/organization-intake/organization-intake.service';
import type { CreateOrganizationIntakeDto } from '../../src/modules/organization-intake/organization-intake.dto';

type RequestEvidenceRow = {
  id: string;
  request_number: string;
  audit_event_id: string;
  outbox_entry_id: string;
  payload_hash: string;
};

type JsonEvidenceRow = { payload: unknown };

const admin = new PrismaService();
let restricted: PrismaClient;
let service: OrganizationIntakeService;

function dto(overrides: Partial<CreateOrganizationIntakeDto> = {}): CreateOrganizationIntakeDto {
  return {
    organizationName: 'ООО Агро Тест',
    inn: '7707083893',
    contactName: 'Иван Иванов',
    position: 'Коммерческий директор',
    phone: '+7 916 123-45-67',
    email: `intake-${randomUUID()}@example.test`,
    organizationRole: 'BUYER_PROCESSOR',
    scenario: 'DEAL_EXECUTION',
    locale: 'ru',
    consent: true,
    website: '',
    ...overrides,
  };
}

async function cleanup(): Promise<void> {
  await admin.$executeRaw(Prisma.sql`
    DELETE FROM public.public_organization_connection_requests
    WHERE source = 'PUBLIC_PLATFORM_V7'
  `);
  await admin.$executeRaw(Prisma.sql`
    DELETE FROM public.outbox_entries
    WHERE type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED'
  `);
  await admin.$executeRaw(Prisma.sql`
    DELETE FROM public.audit_events
    WHERE action = 'public:organization-intake:create'
  `);
}

async function expectRateLimited(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    throw new Error('Expected rate limit rejection');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
  }
}

function restrictedUrl(): string {
  const source = process.env.TEST_ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  if (!source) throw new Error('Database URL is required for organization intake acceptance');
  const url = new URL(source);
  url.username = 'app_deal';
  url.password = 'app_deal_intake_e2e';
  return url.toString();
}

describe('public organization intake PostgreSQL authority', () => {
  beforeAll(async () => {
    await admin.$connect();
    await admin.$executeRawUnsafe(`
      DO $role$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
          CREATE ROLE app_deal LOGIN;
        END IF;
        ALTER ROLE app_deal LOGIN PASSWORD 'app_deal_intake_e2e';
      END
      $role$;
    `);
    await admin.$executeRawUnsafe(`
      DO $grant$
      BEGIN
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_deal', current_database());
      END
      $grant$;
    `);
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA public, security TO app_deal');
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION public.lookup_public_organization_connection_request(text, text) TO app_deal',
    );
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION public.create_public_organization_connection_request(text, text, text, text, text, text, text, text, text, text, text, text, text) TO app_deal',
    );
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION security.consume_api_rate_limit(text, text, integer) TO app_deal',
    );
    restricted = new PrismaClient({ datasources: { db: { url: restrictedUrl() } } });
    await restricted.$connect();
    const restrictedPrisma = restricted as unknown as PrismaService;
    service = new OrganizationIntakeService(
      restrictedPrisma,
      new RateLimitService(new RateLimitRepository(restrictedPrisma)),
    );
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await restricted?.$disconnect();
    await admin.$disconnect();
  });

  it('commits request, non-PII audit and non-PII outbox atomically without creating platform authority', async () => {
    const input = dto();
    const idempotencyKey = `intake:${randomUUID()}`;
    const organizationsBefore = await admin.organization.count({ where: { inn: input.inn } });
    const usersBefore = await admin.user.count({ where: { email: input.email } });
    const result = await service.create(input, {
      idempotencyKey,
      correlationId: randomUUID(),
      sourceIp: '198.51.100.11',
    });

    expect(result.status).toBe('NEW');
    expect(result.replay).toBe(false);
    expect(result.requestNumber).toMatch(/^PC-\d{8}-[0-9A-F]{12}$/);

    const requests = await admin.$queryRaw<RequestEvidenceRow[]>(Prisma.sql`
      SELECT
        id,
        "requestNumber" AS request_number,
        "auditEventId" AS audit_event_id,
        "outboxEntryId" AS outbox_entry_id,
        "payloadHash" AS payload_hash
      FROM public.public_organization_connection_requests
      WHERE "idempotencyKey" = ${idempotencyKey}
    `);
    expect(requests).toHaveLength(1);
    expect(requests[0].request_number).toBe(result.requestNumber);
    expect(requests[0].payload_hash).toMatch(/^[0-9a-f]{64}$/);

    const audit = await admin.$queryRaw<JsonEvidenceRow[]>(Prisma.sql`
      SELECT metadata AS payload FROM public.audit_events WHERE id = ${requests[0].audit_event_id}
    `);
    const outbox = await admin.$queryRaw<JsonEvidenceRow[]>(Prisma.sql`
      SELECT payload FROM public.outbox_entries WHERE id = ${requests[0].outbox_entry_id}
    `);
    expect(audit).toHaveLength(1);
    expect(outbox).toHaveLength(1);

    const evidence = JSON.stringify([audit[0].payload, outbox[0].payload]);
    for (const personalValue of [input.organizationName, input.inn, input.contactName, input.position, input.phone, input.email]) {
      expect(evidence).not.toContain(personalValue);
    }
    expect(evidence).not.toContain(requests[0].payload_hash);
    expect(evidence).not.toContain('payloadHash');
    expect(await admin.organization.count({ where: { inn: input.inn } })).toBe(organizationsBefore);
    expect(await admin.user.count({ where: { email: input.email } })).toBe(usersBefore);
  });

  it('denies direct restricted-principal writes outside the command function', async () => {
    await expect(restricted.$executeRawUnsafe(`
      INSERT INTO public.audit_events (
        id, action, "actorUserId", "actorRole", "objectType", "objectId", outcome, hash, "createdAt"
      ) VALUES (
        'forbidden-direct-intake-audit', 'public:organization-intake:create',
        'public:organization-intake', 'PUBLIC', 'PublicOrganizationConnectionRequest',
        'public-org-request-forbidden', 'SUCCESS', '', now()
      )
    `)).rejects.toBeDefined();
  });

  it('returns the original request before rate-limit rejection and rejects conflicting replay', async () => {
    const input = dto();
    const idempotencyKey = `intake:${randomUUID()}`;
    const sourceIp = '203.0.113.21';
    const context = { idempotencyKey, correlationId: randomUUID(), sourceIp };

    const first = await service.create(input, context);
    for (let index = 0; index < 4; index += 1) {
      await service.create(dto({ email: `replay-limit-${index}-${randomUUID()}@example.test` }), {
        idempotencyKey: `intake:${randomUUID()}`,
        correlationId: randomUUID(),
        sourceIp,
      });
    }
    const replay = await service.create(input, { ...context, correlationId: randomUUID() });
    expect(replay.requestNumber).toBe(first.requestNumber);
    expect(replay.correlationId).toBe(first.correlationId);
    expect(replay.replay).toBe(true);

    await expect(service.create({ ...input, organizationName: 'ООО Другой Пейлоад' }, {
      ...context,
      correlationId: randomUUID(),
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('serializes simultaneous exact submissions into one durable request', async () => {
    const input = dto();
    const idempotencyKey = `intake-race:${randomUUID()}`;
    const [first, second] = await Promise.all([
      service.create(input, {
        idempotencyKey,
        correlationId: `race-a:${randomUUID()}`,
        sourceIp: '203.0.113.31',
      }),
      service.create(input, {
        idempotencyKey,
        correlationId: `race-b:${randomUUID()}`,
        sourceIp: '203.0.113.32',
      }),
    ]);
    expect(first.requestNumber).toBe(second.requestNumber);
    expect([first.replay, second.replay].sort()).toEqual([false, true]);
  });

  it('enforces database-backed per-IP and per-email limits using no raw network fields', async () => {
    const sharedIp = '192.0.2.31';
    for (let index = 0; index < 5; index += 1) {
      await service.create(dto({ email: `ip-limit-${index}-${randomUUID()}@example.test` }), {
        idempotencyKey: `intake:${randomUUID()}`,
        correlationId: randomUUID(),
        sourceIp: sharedIp,
      });
    }
    await expectRateLimited(service.create(dto(), {
      idempotencyKey: `intake:${randomUUID()}`,
      correlationId: randomUUID(),
      sourceIp: sharedIp,
    }));

    const sharedEmail = `email-limit-${randomUUID()}@example.test`;
    for (let index = 0; index < 3; index += 1) {
      await service.create(dto({ email: sharedEmail }), {
        idempotencyKey: `intake:${randomUUID()}`,
        correlationId: randomUUID(),
        sourceIp: `198.18.${index + 1}.41`,
      });
    }
    await expectRateLimited(service.create(dto({ email: sharedEmail }), {
      idempotencyKey: `intake:${randomUUID()}`,
      correlationId: randomUUID(),
      sourceIp: '198.19.1.51',
    }));

    const columns = await admin.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'public_organization_connection_requests'
    `);
    const names = columns.map((column) => column.column_name.toLowerCase());
    expect(names).not.toContain('ip');
    expect(names).not.toContain('ipaddress');
    expect(names).not.toContain('useragent');
  });
});
