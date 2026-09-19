import { Prisma, PrismaClient } from '@prisma/client';
import { createServer, type Server } from 'node:http';
import { hostname } from 'node:os';
import { readFileSync } from 'node:fs';
import {
  decryptAuthMailEnvelope,
  type EncryptedAuthMailEnvelope,
  resolveAuthMailOutboxKey,
  resolveCurrentAuthMailKeyVersion,
} from './modules/auth-mail/auth-mail-crypto';
import { isRetryableAuthMailFailure } from './modules/auth-mail/auth-mail-retry-policy';
import {
  AuthMailTransportError,
  resolveAuthMailSmtpConfig,
  sendAuthMailSmtp,
} from './modules/auth-mail/auth-mail-smtp';

const DEFAULT_INTERVAL_MS = 1_000;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_LEASE_SECONDS = 60;
const DEFAULT_RETENTION_DAYS = 7;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const BASE_BACKOFF_MS = 5_000;

type ClaimedMail = {
  id: string;
  message_kind: string;
  payload_ciphertext: string;
  payload_iv: string;
  payload_tag: string;
  payload_key_version: number;
  idempotency_key: string;
  correlation_id: string;
  max_attempts: number;
  attempt_count: number;
  lease_token: string;
  expires_at: Date;
};

type WorkerState = {
  workerId: string;
  startedAt: string;
  currentKeyVersion: number;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  claimed: number;
  sent: number;
  retried: number;
  deadLettered: number;
  redacted: number;
  shuttingDown: boolean;
};

function positiveInteger(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) return fallback;
  return parsed;
}

function production(): boolean {
  return String(process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

function readSecretFile(name: string): string {
  const filePath = String(process.env[name] ?? '').trim();
  if (!filePath) throw new Error(`${name} is required`);
  const value = readFileSync(filePath, 'utf8').trim();
  if (!value || /[\r\n\0]/.test(value)) throw new Error(`${name} contains an invalid secret value`);
  return value;
}

function resolveMailDatabaseUrl(): string {
  const url = readSecretFile('AUTH_MAIL_DATABASE_URL_FILE');
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.username || !parsed.password || !parsed.hostname || !parsed.pathname.slice(1)) {
    throw new Error('AUTH_MAIL_DATABASE_URL_FILE does not contain a complete PostgreSQL URL');
  }
  if (production() && decodeURIComponent(parsed.username) !== 'pc_auth_mail_runtime') {
    throw new Error('Auth-mail worker must use PostgreSQL principal pc_auth_mail_runtime in production');
  }
  return url;
}

function sanitizeError(error: unknown): string {
  if (error instanceof AuthMailTransportError) return error.code.slice(0, 120);
  const name = error instanceof Error ? error.name : 'UNKNOWN';
  return `AUTH_MAIL_${String(name).replace(/[^A-Z0-9_]/gi, '_').toUpperCase()}`.slice(0, 120);
}

function backoffMs(attemptCount: number): number {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(attemptCount, 10));
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.max(BASE_BACKOFF_MS, Math.floor(exponential * jitter));
}

async function expireStale(prisma: PrismaClient, state: WorkerState): Promise<void> {
  const count = await prisma.$executeRaw(Prisma.sql`
    UPDATE auth.mail_outbox
    SET status = 'DEAD_LETTER',
        last_error_code = 'MESSAGE_EXPIRED',
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE status IN ('PENDING', 'PROCESSING')
      AND expires_at <= clock_timestamp()
  `);
  state.deadLettered += count;
}

async function redactTerminal(prisma: PrismaClient, state: WorkerState, retentionDays: number): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<Array<{ redacted: number }>>(Prisma.sql`
    SELECT auth.redact_terminal_mail_outbox(${cutoff}) AS redacted
  `);
  state.redacted += Number(rows[0]?.redacted ?? 0);
}

async function claimBatch(
  prisma: PrismaClient,
  workerId: string,
  limit: number,
  leaseSeconds: number,
): Promise<ClaimedMail[]> {
  return prisma.$queryRaw<ClaimedMail[]>(Prisma.sql`
    UPDATE auth.mail_outbox
    SET status = 'PROCESSING',
        lease_owner = ${workerId},
        lease_token = md5(random()::text || clock_timestamp()::text || id),
        lease_expires_at = clock_timestamp() + (${leaseSeconds} * INTERVAL '1 second'),
        updated_at = clock_timestamp()
    WHERE id IN (
      SELECT id
      FROM auth.mail_outbox
      WHERE redacted_at IS NULL
        AND expires_at > clock_timestamp()
        AND (
          (status = 'PENDING' AND next_attempt_at <= clock_timestamp())
          OR (status = 'PROCESSING' AND lease_expires_at < clock_timestamp())
        )
      ORDER BY next_attempt_at, created_at, id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      id, message_kind, payload_ciphertext, payload_iv, payload_tag, payload_key_version,
      idempotency_key, correlation_id, max_attempts, attempt_count, lease_token, expires_at
  `);
}

async function markSent(prisma: PrismaClient, workerId: string, entry: ClaimedMail): Promise<void> {
  const count = await prisma.$executeRaw(Prisma.sql`
    UPDATE auth.mail_outbox
    SET status = 'SENT',
        sent_at = clock_timestamp(),
        last_error_code = NULL,
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = ${entry.id}
      AND status = 'PROCESSING'
      AND lease_owner = ${workerId}
      AND lease_token = ${entry.lease_token}
      AND lease_expires_at >= clock_timestamp()
  `);
  if (count !== 1) throw new Error('AUTH_MAIL_LEASE_LOST_AFTER_SEND');
}

async function markFailure(
  prisma: PrismaClient,
  workerId: string,
  entry: ClaimedMail,
  errorCode: string,
): Promise<'RETRY' | 'DEAD_LETTER'> {
  const attemptCount = entry.attempt_count + 1;
  const expired = entry.expires_at.getTime() <= Date.now();
  const retryable = isRetryableAuthMailFailure(errorCode);
  const terminal = !retryable || expired || attemptCount >= entry.max_attempts;
  if (terminal) {
    const count = await prisma.$executeRaw(Prisma.sql`
      UPDATE auth.mail_outbox
      SET status = 'DEAD_LETTER',
          attempt_count = ${Math.min(attemptCount, entry.max_attempts)},
          last_error_code = ${expired ? 'MESSAGE_EXPIRED' : errorCode},
          lease_owner = NULL,
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = clock_timestamp()
      WHERE id = ${entry.id}
        AND status = 'PROCESSING'
        AND lease_owner = ${workerId}
        AND lease_token = ${entry.lease_token}
    `);
    if (count !== 1) throw new Error('AUTH_MAIL_LEASE_LOST_ON_DEAD_LETTER');
    return 'DEAD_LETTER';
  }

  const retryAt = new Date(Date.now() + backoffMs(entry.attempt_count));
  const count = await prisma.$executeRaw(Prisma.sql`
    UPDATE auth.mail_outbox
    SET status = 'PENDING',
        attempt_count = ${attemptCount},
        next_attempt_at = ${retryAt},
        last_error_code = ${errorCode},
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = clock_timestamp()
    WHERE id = ${entry.id}
      AND status = 'PROCESSING'
      AND lease_owner = ${workerId}
      AND lease_token = ${entry.lease_token}
  `);
  if (count !== 1) throw new Error('AUTH_MAIL_LEASE_LOST_ON_RETRY');
  return 'RETRY';
}

async function processEntry(prisma: PrismaClient, workerId: string, entry: ClaimedMail): Promise<'SENT' | 'RETRY' | 'DEAD_LETTER'> {
  try {
    const encrypted: EncryptedAuthMailEnvelope = {
      ciphertext: entry.payload_ciphertext,
      iv: entry.payload_iv,
      tag: entry.payload_tag,
      keyVersion: entry.payload_key_version,
    };
    const envelope = decryptAuthMailEnvelope(encrypted, {
      kind: entry.message_kind,
      idempotencyKey: entry.idempotency_key,
      correlationId: entry.correlation_id,
    });
    await sendAuthMailSmtp(envelope, entry.id);
    await markSent(prisma, workerId, entry);
    return 'SENT';
  } catch (error) {
    return markFailure(prisma, workerId, entry, sanitizeError(error));
  }
}

async function startHealthServer(prisma: PrismaClient, state: WorkerState, port: number): Promise<Server> {
  const server = createServer(async (request, response) => {
    const route = request.url?.split('?', 1)[0] ?? '/';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Type', 'application/json');

    if (route === '/live') {
      response.statusCode = state.shuttingDown ? 503 : 200;
      response.end(JSON.stringify({ status: state.shuttingDown ? 'stopping' : 'alive', component: 'auth-mail-worker' }));
      return;
    }

    if (route === '/ready') {
      let database = false;
      try {
        const rows = await prisma.$queryRaw<Array<{ current_user: string }>>(Prisma.sql`SELECT current_user`);
        database = rows[0]?.current_user === 'pc_auth_mail_runtime';
      } catch {
        database = false;
      }
      const ready = !state.shuttingDown && database;
      response.statusCode = ready ? 200 : 503;
      response.end(JSON.stringify({
        status: ready ? 'ready' : 'unavailable',
        component: 'auth-mail-worker',
        checks: { database, smtpConfiguration: true, outboxKey: true, currentKeyVersion: state.currentKeyVersion },
      }));
      return;
    }

    if (route === '/metrics') {
      response.statusCode = 200;
      response.end(JSON.stringify({
        component: 'auth-mail-worker',
        claimed: state.claimed,
        sent: state.sent,
        retried: state.retried,
        deadLettered: state.deadLettered,
        redacted: state.redacted,
        lastPollAt: state.lastPollAt,
        lastSuccessAt: state.lastSuccessAt,
        lastErrorCode: state.lastErrorCode,
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function bootstrap(): Promise<void> {
  if (production() && process.env.RUNTIME_COMPONENT !== 'auth-mail-worker') {
    throw new Error('RUNTIME_COMPONENT must equal auth-mail-worker in production');
  }
  if (process.env.AUTH_MAIL_WORKER_ENABLED !== 'true') {
    throw new Error('AUTH_MAIL_WORKER_ENABLED must equal true');
  }

  const currentKeyVersion = resolveCurrentAuthMailKeyVersion();
  resolveAuthMailOutboxKey(currentKeyVersion);
  resolveAuthMailSmtpConfig();
  const databaseUrl = resolveMailDatabaseUrl();
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.$connect();
  const principal = await prisma.$queryRaw<Array<{ current_user: string; superuser: boolean; bypassrls: boolean }>>(Prisma.sql`
    SELECT current_user,
           (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser,
           (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypassrls
  `);
  if (principal[0]?.current_user !== 'pc_auth_mail_runtime' || principal[0]?.superuser || principal[0]?.bypassrls) {
    throw new Error('Auth-mail PostgreSQL principal boundary failed');
  }

  const workerId = String(process.env.AUTH_MAIL_WORKER_ID || `${hostname()}-${process.pid}`).slice(0, 120);
  const intervalMs = positiveInteger(process.env.AUTH_MAIL_WORKER_INTERVAL_MS, DEFAULT_INTERVAL_MS, 60_000);
  const batchSize = positiveInteger(process.env.AUTH_MAIL_WORKER_BATCH_SIZE, DEFAULT_BATCH_SIZE, 100);
  const leaseSeconds = positiveInteger(process.env.AUTH_MAIL_WORKER_LEASE_SECONDS, DEFAULT_LEASE_SECONDS, 900);
  const retentionDays = positiveInteger(process.env.AUTH_MAIL_RETENTION_DAYS, DEFAULT_RETENTION_DAYS, 365);
  const healthPort = positiveInteger(process.env.AUTH_MAIL_WORKER_HEALTH_PORT, 3003, 65_535);
  const state: WorkerState = {
    workerId,
    startedAt: new Date().toISOString(),
    currentKeyVersion,
    lastPollAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
    claimed: 0,
    sent: 0,
    retried: 0,
    deadLettered: 0,
    redacted: 0,
    shuttingDown: false,
  };

  const server = await startHealthServer(prisma, state, healthPort);
  let running: Promise<void> | undefined;
  const poll = () => {
    if (state.shuttingDown || running) return;
    running = (async () => {
      state.lastPollAt = new Date().toISOString();
      await expireStale(prisma, state);
      await redactTerminal(prisma, state, retentionDays);
      const batch = await claimBatch(prisma, workerId, batchSize, leaseSeconds);
      state.claimed += batch.length;
      for (const entry of batch) {
        const outcome = await processEntry(prisma, workerId, entry);
        if (outcome === 'SENT') {
          state.sent += 1;
          state.lastSuccessAt = new Date().toISOString();
          state.lastErrorCode = null;
        } else if (outcome === 'RETRY') {
          state.retried += 1;
        } else {
          state.deadLettered += 1;
        }
      }
    })()
      .catch((error) => {
        state.lastErrorCode = sanitizeError(error);
      })
      .finally(() => {
        running = undefined;
      });
  };

  const timer = setInterval(poll, intervalMs);
  timer.unref?.();
  poll();

  const shutdown = async () => {
    if (state.shuttingDown) return;
    state.shuttingDown = true;
    clearInterval(timer);
    await running;
    await closeServer(server).catch(() => undefined);
    await prisma.$disconnect();
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
}

bootstrap().catch((error) => {
  const code = sanitizeError(error);
  process.stderr.write(`Auth-mail worker failed to start: ${code}\n`);
  process.exitCode = 1;
});
