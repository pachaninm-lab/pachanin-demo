import { shutdownTelemetry } from './tracing';
import 'reflect-metadata';
import { createServer, type Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { register } from 'prom-client';
import { MarketingOutboxWorkerModule } from './marketing-outbox-worker.module';
import { MaskedLoggerService } from './common/logger/masked-logger.service';
import { PrismaService } from './common/prisma/prisma.service';
import { MarketingOutboxRunner } from './modules/marketing/marketing-outbox.runner';
import { marketingPublicationAdmissionSecret } from './modules/marketing/marketing-publication-admission';

function positivePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(
      `MARKETING_OUTBOX_WORKER_HEALTH_PORT must be an integer between 1 and 65535; received ${value}`,
    );
  }
  return parsed;
}

function assertWorkerStartup(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('Marketing outbox worker startup blocked: DATABASE_URL is required');
  }
  if (process.env.MARKETING_OUTBOX_WORKER_ENABLED !== 'true') {
    throw new Error(
      'Marketing outbox worker startup blocked: MARKETING_OUTBOX_WORKER_ENABLED must equal true',
    );
  }
  if (process.env.MARKETING_OUTBOUND_ENABLED === 'true' && !marketingPublicationAdmissionSecret()) {
    throw new Error(
      'Marketing outbox worker startup blocked: MARKETING_PUBLICATION_ADMISSION_HMAC_SECRET is required when outbound is enabled',
    );
  }
  if (
    process.env.NODE_ENV === 'production'
    && process.env.RUNTIME_COMPONENT !== 'marketing-outbox-worker'
  ) {
    throw new Error(
      'Marketing outbox worker startup blocked: RUNTIME_COMPONENT must equal marketing-outbox-worker in production',
    );
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function writeStdout(message: string): Promise<void> {
  await new Promise<void>((resolve) => process.stdout.write(message, () => resolve()));
}

async function writeStderr(message: string): Promise<void> {
  await new Promise<void>((resolve) => process.stderr.write(message, () => resolve()));
}

async function bootstrap(): Promise<void> {
  assertWorkerStartup();

  const app = await NestFactory.createApplicationContext(MarketingOutboxWorkerModule, {
    logger: new MaskedLoggerService(),
  });
  const prisma = app.get(PrismaService);
  const runner = app.get(MarketingOutboxRunner);
  const port = positivePort(process.env.MARKETING_OUTBOX_WORKER_HEALTH_PORT, 3004);
  let shuttingDown = false;

  const server = createServer(async (request, response) => {
    const path = request.url?.split('?', 1)[0] ?? '/';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (path === '/live') {
      response.statusCode = shuttingDown ? 503 : 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({
        status: shuttingDown ? 'stopping' : 'alive',
        component: 'marketing-outbox-worker',
        pid: process.pid,
        ts: new Date().toISOString(),
      }));
      return;
    }

    if (path === '/ready') {
      let database = 'failed';
      try {
        await prisma.$queryRaw`SELECT 1`;
        database = 'ok';
      } catch {
        database = 'failed';
      }
      const runnerHealth = runner.health();
      const ready =
        !shuttingDown
        && database === 'ok'
        && runnerHealth.enabled
        && runnerHealth.started
        && !runnerHealth.stopped;

      response.statusCode = ready ? 200 : 503;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({
        status: ready ? 'ready' : 'unavailable',
        component: 'marketing-outbox-worker',
        checks: { database, runner: runnerHealth },
        ts: new Date().toISOString(),
      }));
      return;
    }

    if (path === '/metrics') {
      response.statusCode = 200;
      response.setHeader('Content-Type', register.contentType);
      response.end(await register.metrics());
      return;
    }

    response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const shutdown = async (signal: string, requestedExitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    let exitCode = requestedExitCode;

    await closeServer(server).catch(() => undefined);
    await app.close();
    await shutdownTelemetry().catch(async (error: unknown) => {
      exitCode = 1;
      await writeStderr(
        `OpenTelemetry shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    });
    await writeStdout(`Marketing outbox worker stopped signal=${signal}\n`);
    process.exitCode = exitCode;
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('uncaughtException', (error) => {
    void writeStderr(
      `Marketing outbox worker uncaught exception: ${error instanceof Error ? error.stack : String(error)}\n`,
    ).finally(() => shutdown('uncaughtException', 1));
  });
  process.once('unhandledRejection', (error) => {
    void writeStderr(
      `Marketing outbox worker unhandled rejection: ${error instanceof Error ? error.stack : String(error)}\n`,
    ).finally(() => shutdown('unhandledRejection', 1));
  });

  await writeStdout(`Marketing outbox worker running healthPort=${port}\n`);
}

bootstrap().catch(async (error) => {
  await writeStderr(
    `Failed to start marketing outbox worker: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  await shutdownTelemetry().catch(() => undefined);
  process.exitCode = 1;
});
