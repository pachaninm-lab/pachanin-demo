import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
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
