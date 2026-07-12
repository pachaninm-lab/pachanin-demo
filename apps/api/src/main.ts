import './tracing';
import './sentry';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { MaskedLoggerService } from './common/logger/masked-logger.service';
import { createTrustedProxyPolicy } from './common/security/trusted-proxy';
import { assertIndustrialProductionStartup, INDUSTRIAL_CORE_MIGRATION } from './common/config/industrial-mode';
import { PrismaService } from './common/prisma/prisma.service';

// Prometheus metrics setup
collectDefaultMetrics({ prefix: 'grainflow_' });
const httpRequestsTotal = new Counter({
  name: 'grainflow_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});
const httpDurationHistogram = new Histogram({
  name: 'grainflow_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

async function bootstrap() {
  // Proxy trust must be explicit before Express derives req.ip. In production an
  // omitted/invalid mode terminates startup instead of trusting arbitrary XFF.
  const trustedProxyPolicy = createTrustedProxyPolicy(process.env);

  // Fail closed before anything binds: production cannot start on in-memory
  // authority, without PostgreSQL, or with test-account/runtime-mutation flags.
  assertIndustrialProductionStartup(process.env);

  // Configure external integrations from env before anything binds: swap the
  // in-memory mocks for live adapters wherever `<NAME>_MODE=live|sandbox`, and
  // validate the required credentials up-front. Default (no `*_MODE` set) keeps
  // the mocks. A live/sandbox misconfiguration throws here (fail-closed) so the
  // process exits before opening the port instead of silently serving mocks.
  const { configureIntegrationsFromEnv } = await import(
    '../../../packages/integration-sdk/src/live/live-registry'
  );
  const integrationModes = configureIntegrationsFromEnv();
  if (integrationModes.live.length > 0) {
    console.log(`Live integrations enabled: ${integrationModes.live.join(', ')}`);
  }

  const app = await NestFactory.create(AppModule, {
    logger: new MaskedLoggerService(),
  });
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyPolicy.expressSetting);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // HTTP metrics instrumentation
  app.use((req: any, res: any, next: () => void) => {
    const end = httpDurationHistogram.startTimer({ method: req.method, route: req.path });
    res.on('finish', () => {
      httpRequestsTotal.inc({ method: req.method, route: req.path, status_code: res.statusCode });
      end();
    });
    next();
  });

  // Security headers
  app.use((_req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api', { exclude: ['health', 'ready', 'version', 'metrics'] });

  app.getHttpAdapter().get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', ts: new Date().toISOString(), env: process.env.NODE_ENV || 'development' });
  });

  // /ready reports readiness only after real dependency checks: a live
  // PostgreSQL round-trip and fully applied migrations including the
  // industrial transaction core. /health above stays a pure liveness probe.
  const prisma = app.get(PrismaService, { strict: false });
  app.getHttpAdapter().get('/ready', async (_req: any, res: any) => {
    const checks: Record<string, string> = { api: 'ok', database: 'unknown', migrations: 'unknown' };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
      const rows = (await prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*)::int FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,
          (SELECT COUNT(*)::int FROM "_prisma_migrations" WHERE migration_name = ${INDUSTRIAL_CORE_MIGRATION} AND finished_at IS NOT NULL) AS core
      `) as Array<{ unfinished: number; core: number }>;
      const state = rows[0];
      checks.migrations = state && state.unfinished === 0 && state.core > 0 ? 'ok' : 'pending';
    } catch {
      checks.database = checks.database === 'ok' ? 'ok' : 'failed';
      if (checks.migrations === 'unknown') checks.migrations = 'failed';
    }
    const ready = checks.database === 'ok' && checks.migrations === 'ok';
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'unavailable',
      checks,
      ts: new Date().toISOString(),
    });
  });

  app.getHttpAdapter().get('/version', (_req: any, res: any) => {
    res.json({
      version: process.env.APP_VERSION || '3.0.0',
      commit: process.env.GIT_COMMIT || 'local',
      buildDate: process.env.BUILD_DATE || new Date().toISOString().split('T')[0],
      env: process.env.NODE_ENV || 'development',
    });
  });

  app.getHttpAdapter().get('/metrics', async (_req: any, res: any) => {
    const metrics = await register.metrics();
    res.setHeader('Content-Type', register.contentType);
    res.send(metrics);
  });

  app.getHttpAdapter().get('/health/detailed', async (_req: any, res: any) => {
    const { integrationRegistry } = await import('../../../packages/integration-sdk/src/registry');
    const adapterHealth = await integrationRegistry.healthCheckAll().catch(() => ({}));
    const database = await prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'failed');
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      integrations: adapterHealth,
      ts: new Date().toISOString(),
    });
  });

  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
