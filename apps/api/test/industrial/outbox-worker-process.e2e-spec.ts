import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { Kafka, type Consumer } from 'kafkajs';
import { PrismaClient } from '@prisma/client';

jest.setTimeout(180_000);

const RUN_ID = `worker.process.${Date.now()}.${Math.random().toString(16).slice(2)}`;
const TOPIC = 'grainflow.domain.events';
const PROCESS_TOPOLOGY_ENABLED = Boolean(
  process.env.OUTBOX_DATABASE_URL?.trim()
  && process.env.TEST_ADMIN_DATABASE_URL?.trim()
  && process.env.KAFKA_BROKERS?.trim(),
);
const WORKER_DATABASE_URL = process.env.OUTBOX_DATABASE_URL ?? process.env.DATABASE_URL!;
const ADMIN_DATABASE_URL = process.env.TEST_ADMIN_DATABASE_URL!;
const KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
const workerEntry = resolve(process.cwd(), 'dist-outbox-worker/outbox-worker.js');
const topologyIt = PROCESS_TOPOLOGY_ENABLED ? it : it.skip;

interface WorkerProcess {
  id: string;
  port: number;
  process: ChildProcess;
  stdout: string[];
  stderr: string[];
}

type PrivilegeRow = {
  current_user: string;
  outbox_select: boolean;
  outbox_insert: boolean;
  outbox_delete: boolean;
  deal_select: boolean;
  redrive_select: boolean;
  auth_usage: boolean;
};

const prisma = new PrismaClient({
  datasources: { db: { url: ADMIN_DATABASE_URL } },
});
const outboxPrisma = new PrismaClient({
  datasources: { db: { url: WORKER_DATABASE_URL } },
});
const kafka = new Kafka({ clientId: `${RUN_ID}.acceptance`, brokers: KAFKA_BROKERS.split(',') });
let consumer: Consumer;
let consumerJoined = false;
const deliveredIds = new Set<string>();
const deliveryCounts = new Map<string, number>();
const workers: WorkerProcess[] = [];

async function waitFor(predicate: () => Promise<boolean> | boolean, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms${lastError ? `: ${String(lastError)}` : ''}`);
}

function startWorker(id: string, port: number): WorkerProcess {
  const child = spawn(process.execPath, [workerEntry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      RUNTIME_COMPONENT: 'outbox-worker',
      DATABASE_URL: WORKER_DATABASE_URL,
      KAFKA_BROKERS,
      KAFKA_REQUIRED: 'true',
      KAFKA_CLIENT_ID: id,
      OUTBOX_WORKER_ENABLED: 'true',
      OUTBOX_WORKER_ID: id,
      OUTBOX_WORKER_HEALTH_PORT: String(port),
      OUTBOX_WORKER_INTERVAL_MS: '100',
      OUTBOX_WORKER_BATCH_SIZE: '10',
      OUTBOX_WORKER_HEARTBEAT_MS: '500',
      OTEL_SDK_DISABLED: 'true',
      SENTRY_DSN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const worker: WorkerProcess = { id, port, process: child, stdout: [], stderr: [] };
  child.stdout!.setEncoding('utf8');
  child.stderr!.setEncoding('utf8');
  child.stdout!.on('data', (chunk: string) => worker.stdout.push(chunk));
  child.stderr!.on('data', (chunk: string) => worker.stderr.push(chunk));
  workers.push(worker);
  return worker;
}

async function waitReady(worker: WorkerProcess): Promise<void> {
  await waitFor(async () => {
    if (worker.process.exitCode !== null) {
      throw new Error(`${worker.id} exited early code=${worker.process.exitCode}: ${worker.stderr.join('')}`);
    }
    const response = await fetch(`http://127.0.0.1:${worker.port}/ready`).catch(() => null);
    return response?.status === 200;
  }, 45_000);
}

async function waitForClose(worker: WorkerProcess, timeoutMs = 30_000): Promise<number | null> {
  if (worker.process.exitCode !== null && worker.process.stdout?.destroyed && worker.process.stderr?.destroyed) {
    return worker.process.exitCode;
  }
  return await Promise.race([
    new Promise<number | null>((resolveClose) => worker.process.once('close', (code) => resolveClose(code))),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${worker.id} did not close`)), timeoutMs)),
  ]);
}

async function seedEntries(suffix: string, count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = await prisma.outboxEntry.create({
      data: {
        type: `${RUN_ID}.${suffix}`,
        status: 'PENDING',
        payload: { runId: RUN_ID, suffix, index },
        nextRetryAt: new Date(Date.now() - 1_000),
        maxRetries: 10,
        idempotencyKey: `${RUN_ID}.${suffix}.${index}`,
        correlationId: RUN_ID,
      },
    });
    ids.push(row.id);
  }
  return ids;
}

async function waitSent(ids: string[]): Promise<void> {
  await waitFor(async () => {
    const sent = await prisma.outboxEntry.count({ where: { id: { in: ids }, status: 'SENT' } });
    return sent === ids.length;
  }, 60_000);
}

function assertDeliveredExactlyOnce(ids: string[]): void {
  for (const id of ids) {
    expect(deliveryCounts.get(id)).toBe(1);
  }
}

beforeAll(async () => {
  if (!PROCESS_TOPOLOGY_ENABLED) return;
  await Promise.all([prisma.$connect(), outboxPrisma.$connect()]);

  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: [{ topic: TOPIC, numPartitions: 3, replicationFactor: 1 }],
  });
  await admin.disconnect();

  consumer = kafka.consumer({ groupId: `${RUN_ID}.consumer` });
  consumer.on(consumer.events.GROUP_JOIN, () => {
    consumerJoined = true;
  });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.headers?.['x-outbox-id'];
      const id = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw?.toString();
      if (id) {
        deliveredIds.add(id);
        deliveryCounts.set(id, (deliveryCounts.get(id) ?? 0) + 1);
      }
    },
  });
  // consumer.run() starts asynchronously. Do not seed durable work until the
  // unique acceptance consumer has joined its Kafka group, otherwise
  // fromBeginning=false can legitimately skip records produced in that window.
  await waitFor(() => consumerJoined, 30_000);
});

afterAll(async () => {
  if (!PROCESS_TOPOLOGY_ENABLED) return;
  for (const worker of workers) {
    if (worker.process.exitCode === null) worker.process.kill('SIGKILL');
  }
  await consumer?.disconnect().catch(() => undefined);
  await prisma.outboxEntry.deleteMany({ where: { correlationId: RUN_ID } }).catch(() => undefined);
  await Promise.all([prisma.$disconnect(), outboxPrisma.$disconnect()]);
});

describe('independent outbox worker process topology', () => {
  topologyIt('proves the live app_outbox privilege boundary', async () => {
    const rows = await outboxPrisma.$queryRaw<PrivilegeRow[]>`
      SELECT
        current_user,
        has_table_privilege(current_user, 'public.outbox_entries', 'SELECT') AS outbox_select,
        has_table_privilege(current_user, 'public.outbox_entries', 'INSERT') AS outbox_insert,
        has_table_privilege(current_user, 'public.outbox_entries', 'DELETE') AS outbox_delete,
        has_table_privilege(current_user, 'public.deals', 'SELECT') AS deal_select,
        has_table_privilege(current_user, 'public.outbox_redrive_events', 'SELECT') AS redrive_select,
        has_schema_privilege(current_user, 'auth', 'USAGE') AS auth_usage
    `;
    expect(rows).toEqual([{
      current_user: 'app_outbox',
      outbox_select: true,
      outbox_insert: false,
      outbox_delete: false,
      deal_select: false,
      redrive_select: false,
      auth_usage: false,
    }]);
  });

  topologyIt('runs two replica-safe workers, survives one process loss and shuts down gracefully', async () => {
    const workerA = startWorker(`${RUN_ID}.worker-a`, 3301);
    const workerB = startWorker(`${RUN_ID}.worker-b`, 3302);
    await Promise.all([waitReady(workerA), waitReady(workerB)]);

    const initialIds = await seedEntries('initial', 30);
    await waitSent(initialIds);
    await waitFor(() => initialIds.every((id) => deliveredIds.has(id)), 60_000);
    assertDeliveredExactlyOnce(initialIds);

    workerA.process.kill('SIGKILL');
    await waitForClose(workerA);
    expect(workerA.process.signalCode).toBe('SIGKILL');

    const failoverIds = await seedEntries('after-worker-a-loss', 10);
    await waitSent(failoverIds);
    await waitFor(() => failoverIds.every((id) => deliveredIds.has(id)), 60_000);
    assertDeliveredExactlyOnce(failoverIds);

    const readyResponse = await fetch(`http://127.0.0.1:${workerB.port}/ready`);
    expect(readyResponse.status).toBe(200);
    const ready = await readyResponse.json() as {
      checks: { kafka: { connected: boolean; clientId: string }; runner: { started: boolean; stopped: boolean } };
    };
    expect(ready.checks.kafka).toEqual(expect.objectContaining({
      connected: true,
      clientId: `${RUN_ID}.worker-b`,
    }));
    expect(ready.checks.runner).toEqual(expect.objectContaining({ started: true, stopped: false }));

    workerB.process.kill('SIGTERM');
    await expect(waitForClose(workerB)).resolves.toBe(0);
    expect(workerB.stdout.join('')).toContain('Outbox worker stopped signal=SIGTERM');
  });
});
