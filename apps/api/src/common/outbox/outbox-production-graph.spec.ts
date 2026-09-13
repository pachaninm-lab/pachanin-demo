import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function repoFile(path: string): string {
  const candidates = [
    resolve(process.cwd(), path),
    resolve(process.cwd(), '..', '..', path),
    resolve(__dirname, '..', '..', '..', '..', '..', path),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Repository file not found: ${path}`);
  return found;
}

function source(path: string): string {
  return readFileSync(repoFile(path), 'utf8');
}

describe('IR-OUTBOX production graph', () => {
  it('contains no competing legacy relay file', () => {
    const candidates = [
      resolve(process.cwd(), 'src/common/outbox/outbox-relay.service.ts'),
      resolve(process.cwd(), 'apps/api/src/common/outbox/outbox-relay.service.ts'),
      resolve(__dirname, 'outbox-relay.service.ts'),
    ];
    expect(candidates.some((candidate) => existsSync(candidate))).toBe(false);
  });

  it('contains no process-memory storage or optional PostgreSQL fallback', () => {
    const outbox = source('apps/api/src/common/outbox/outbox.service.ts');
    expect(outbox).not.toContain('private readonly entries');
    expect(outbox).not.toContain('private counter');
    expect(outbox).not.toContain('@Optional()');
    expect(outbox).not.toContain('DB write skipped');
    expect(outbox).toContain('constructor(private readonly prisma: PrismaService)');
    expect(outbox).toContain('outboxRedriveEvent');
  });

  it('exports only the PostgreSQL service from the common outbox module', () => {
    const module = source('apps/api/src/common/outbox/outbox.module.ts');
    expect(module).toContain('providers: [OutboxService]');
    expect(module).not.toContain('OutboxRelayService');
  });

  it('keeps execution opt-in and fail-closed in a separately gated runner', () => {
    const runner = source('apps/api/src/modules/integration-events/durable-outbox.runner.ts');
    expect(runner).toContain("process.env.OUTBOX_WORKER_ENABLED === 'true'");
    expect(runner).toContain('if (!delivered)');
    expect(runner).toContain('TRANSPORT_OUTCOME_UNKNOWN');
    expect(runner).not.toContain('KAFKA_BROKERS not set — Kafka producer disabled (dev mode)');
  });

  it('instantiates the delivery runner only in the dedicated worker process', () => {
    const apiModule = source('apps/api/src/modules/integration-events/integration-events.module.ts');
    const workerModule = source('apps/api/src/outbox-worker.module.ts');
    expect(apiModule).not.toContain('DurableOutboxRunner');
    expect(apiModule).not.toContain('DurableOutboxWorker');
    expect(workerModule).toContain('DurableOutboxRunner');
    expect(workerModule).toContain('DurableOutboxWorker');
  });

  it('uses tokenized SKIP LOCKED claims and CAS acknowledgements', () => {
    const worker = source('apps/api/src/modules/integration-events/durable-outbox.worker.ts');
    expect(worker).toContain('FOR UPDATE SKIP LOCKED');
    expect(worker).toContain(`"type" <> 'MARKETING_SOCIAL_PUBLISH_V1'`);
    expect(worker).toContain('"leaseToken"');
    expect(worker).toContain('AND "leaseToken" = ${leaseToken}');
    expect(worker).toContain('OutboxLeaseLostError');
  });

  it('quarantines pre-migration in-flight rows and binds audit timestamps', () => {
    const migration = source(
      'apps/api/prisma/migrations/20260912235500_canonical_durable_outbox/migration.sql',
    );
    const outbox = source('apps/api/src/common/outbox/outbox.service.ts');
    expect(migration).toContain(`WHERE "status" = 'PROCESSING'`);
    expect(migration).toContain('MIGRATION_IN_FLIGHT_OUTCOME_UNKNOWN');
    expect(migration).toContain(`"status" = 'MANUAL_REVIEW'`);
    expect(migration).toContain(`current_user = 'app_outbox'`);
    expect(migration).toContain(`OLD."type" = 'MARKETING_SOCIAL_PUBLISH_V1'`);
    expect(migration).toContain(`NEW."leaseOwner" LIKE 'marketing-social-%'`);
    expect(outbox).toContain('value instanceof Date');
    expect(outbox).toContain('value.toISOString()');
  });
});
