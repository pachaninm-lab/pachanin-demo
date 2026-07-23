import { ConflictException, TooManyRequestsException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

const prisma = new PrismaService();
const repository = new RateLimitRepository(prisma);
const rateLimit = new RateLimitService(repository);
const service = new OrganizationIntakeService(prisma, rateLimit);

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
    ...overrides,
  };
}

async function cleanup(): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public.public_organization_connection_requests
    WHERE source = 'PUBLIC_PLATFORM_V7'
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public.outbox_entries
    WHERE type = 'PUBLIC_ORGANIZATION_CONNECTION_REQUESTED'
  `);
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM public.audit_events
    WHERE action = 'public:organization-intake:create'
  `);
}

describe('public organization intake PostgreSQL authority', () => {
  beforeAll(async () => {
    await prisma.$connect();
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('commits request, non-PII audit and non-PII outbox atomically', async () => {
    const input = dto();
    const idempotencyKey = `intake:${randomUUID()}`;
    const result = await service.create(input, {
      idempotencyKey,
      correlationId: randomUUID(),
      sourceIp: `198.51.100.${Math.floor(Math.random() * 100) + 1}`,
    });

    expect(result.status).toBe('NEW');
    expect(result.replay).toBe(false);
    expect(result.requestNumber).toMatch(/^PC-\d{8}-[0-9A-F]{12}$/);

    const requests = await prisma.$queryRaw<RequestEvidenceRow[]>(Prisma.sql`
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

    const audit = await prisma.$queryRaw<JsonEvidenceRow[]>(Prisma.sql`
      SELECT metadata AS payload
      FROM public.audit_events
      WHERE id = ${requests[0].audit_event_id}
    `);
    const outbox = await prisma.$queryRaw<JsonEvidenceRow[]>(Prisma.sql`
      SELECT payload
      FROM public.outbox_entries
      WHERE id = ${requests[0].outbox_entry_id}
    `);
    expect(audit).toHaveLength(1);
    expect(outbox).toHaveLength(1);

    const evidence = JSON.stringify([audit[0].payload, outbox[0].payload]);
    for (const personalValue of [input.organizationName, input.inn, input.contactName, input.position, input.phone, input.email]) {
      expect(evidence).not.toContain(personalValue);
    }
    expect(evidence).toContain(requests[0].payload_hash);
  });

  it('returns the original request for exact replay and rejects conflicting replay', async () => {
    const input = dto();
    const idempotencyKey = `intake:${randomUUID()}`;
    const context = { idempotencyKey, correlationId: randomUUID(), sourceIp: `203.0.113.${Date.now() % 200 + 1}` };

    const first = await service.create(input, context);
    const replay = await service.create(input, { ...context, correlationId: randomUUID() });
    expect(replay.requestNumber).toBe(first.requestNumber);
    expect(replay.replay).toBe(true);

    await expect(service.create({ ...input, organizationName: 'ООО Другой Пейлоад' }, {
      ...context,
      correlationId: randomUUID(),
    })).rejects.toBeInstanceOf(ConflictException);

    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT count(*)::bigint AS count
      FROM public.public_organization_connection_requests
      WHERE "idempotencyKey" = ${idempotencyKey}
    `);
    expect(Number(rows[0].count)).toBe(1);
  });

  it('enforces database-backed per-IP and per-email limits using no raw network fields in request rows', async () => {
    const sharedIp = `192.0.2.${Date.now() % 200 + 1}`;
    for (let index = 0; index < 5; index += 1) {
      await service.create(dto({ email: `ip-limit-${index}-${randomUUID()}@example.test` }), {
        idempotencyKey: `intake:${randomUUID()}`,
        correlationId: randomUUID(),
        sourceIp: sharedIp,
      });
    }
    await expect(service.create(dto(), {
      idempotencyKey: `intake:${randomUUID()}`,
      correlationId: randomUUID(),
      sourceIp: sharedIp,
    })).rejects.toBeInstanceOf(TooManyRequestsException);

    const sharedEmail = `email-limit-${randomUUID()}@example.test`;
    for (let index = 0; index < 3; index += 1) {
      await service.create(dto({ email: sharedEmail }), {
        idempotencyKey: `intake:${randomUUID()}`,
        correlationId: randomUUID(),
        sourceIp: `198.18.${index + 1}.${(Date.now() + index) % 200 + 1}`,
      });
    }
    await expect(service.create(dto({ email: sharedEmail }), {
      idempotencyKey: `intake:${randomUUID()}`,
      correlationId: randomUUID(),
      sourceIp: `198.19.1.${Date.now() % 200 + 1}`,
    })).rejects.toBeInstanceOf(TooManyRequestsException);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
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
