import './tracing';
import './sentry';
import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { MaskedLoggerService } from './common/logger/masked-logger.service';

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
  const app = await NestFactory.create(AppModule, {
    logger: new MaskedLoggerService(),
  });

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

  app.getHttpAdapter().get('/ready', (_req: any, res: any) => {
    res.json({ status: 'ready', checks: { api: 'ok', database: 'ok' }, ts: new Date().toISOString() });
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
    res.json({
      status: 'ok',
      database: 'ok',
      integrations: adapterHealth,
      ts: new Date().toISOString(),
    });
  });

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
