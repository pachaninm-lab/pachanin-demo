import './tracing';
import 'reflect-metadata';
import { createServer, type Server } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { register } from 'prom-client';
import { OutboxWorkerModule } from './outbox-worker.module';
import { MaskedLoggerService } from './common/logger/masked-logger.service';
import { PrismaService } from './common/prisma/prisma.service';
import { KafkaProducerService } from './common/kafka/kafka-producer.service';
import { DurableOutboxRunner } from './modules/integration-events/durable-outbox.runner';

function positivePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`OUTBOX_WORKER_HEALTH_PORT must be an integer between 1 and 65535; received ${value}`);
  }
  return parsed;
}

function assertWorkerStartup(): void {
  const required: Array<[string, string | undefined]> = [
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['KAFKA_BROKERS', process.env.KAFKA_BROKERS],
  ];
  for (const [name, value] of required) {
    if (!value?.trim()) throw new Error(`Outbox worker startup blocked: ${name} is required`);
  }
  if (process.env.OUTBOX_WORKER_ENABLED !== 'true') {
    throw new Error('Outbox worker startup blocked: OUTBOX_WORKER_ENABLED must equal true');
  }
  if (process.env.KAFKA_REQUIRED !== 'true') {
    throw new Error('Outbox worker startup blocked: KAFKA_REQUIRED must equal true');
  }
  if (process.env.NODE_ENV === 'production' && process.env.RUNTIME_COMPONENT !== 'outbox-worker') {
    throw new Error('Outbox worker startup blocked: RUNTIME_COMPONENT must equal outbox-worker in production');
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function bootstrap(): Promise<void> {
  assertWorkerStartup();

  const app = await NestFactory.createApplicationContext(OutboxWorkerModule, {
    logger: new MaskedLoggerService(),
  });

  const prisma = app.get(PrismaService);
  const kafka = app.get(KafkaProducerService);
  const runner = app.get(DurableOutboxRunner);
  const port = positivePort(process.env.OUTBOX_WORKER_HEALTH_PORT, 3002);
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
        component: 'outbox-worker',
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
      const kafkaHealth = kafka.health();
      const runnerHealth = runner.health();
      const ready =
        !shuttingDown &&
        database === 'ok' &&
        kafkaHealth.connected &&
        runnerHealth.enabled &&
        runnerHealth.started &&
        !runnerHealth.stopped;

      response.statusCode = ready ? 200 : 503;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({
        status: ready ? 'ready' : 'unavailable',
        component: 'outbox-worker',
        checks: {
          database,
          kafka: kafkaHealth,
          runner: runnerHealth,
        },
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

  const shutdown = async (signal: string, exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    // This process owns signal handling. Closing the Nest context invokes the
    // runner shutdown hook exactly once: stop claims, then await active drain.
    await closeServer(server).catch(() => undefined);
    await app.close();
    process.exitCode = exitCode;
    process.stdout.write(`Outbox worker stopped signal=${signal}\n`);
    // Do not call process.exit(): it can truncate stdout, logs and telemetry.
    // Once the server, Prisma and Kafka handles are closed, Node exits naturally.
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('uncaughtException', (error) => {
    process.stderr.write(`Outbox worker uncaught exception: ${error instanceof Error ? error.stack : String(error)}\n`);
    void shutdown('uncaughtException', 1);
  });
  process.once('unhandledRejection', (error) => {
    process.stderr.write(`Outbox worker unhandled rejection: ${error instanceof Error ? error.stack : String(error)}\n`);
    void shutdown('unhandledRejection', 1);
  });

  process.stdout.write(`Outbox worker running healthPort=${port}\n`);
}

bootstrap().catch((error) => {
  process.stderr.write(`Failed to start outbox worker: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
