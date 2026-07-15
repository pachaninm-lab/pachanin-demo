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
    expect(runner).toContain('Kafka transport is disabled or delivery failed');
    expect(runner).not.toContain('KAFKA_BROKERS not set — Kafka producer disabled (dev mode)');
  });

  it('uses tokenized SKIP LOCKED claims and CAS acknowledgements', () => {
    const worker = source('apps/api/src/modules/integration-events/durable-outbox.worker.ts');
    expect(worker).toContain('FOR UPDATE SKIP LOCKED');
    expect(worker).toContain('"leaseToken"');
    expect(worker).toContain('AND "leaseToken" = ${leaseToken}');
    expect(worker).toContain('OutboxLeaseLostError');
  });
});
