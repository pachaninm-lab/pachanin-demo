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

  app.setGlobalPrefix('api', { exclude: ['health'] });

  app.getHttpAdapter().get('/health', (_req: any, res: any) => {
    res.json({ status: 'ok', ts: new Date().toISOString(), env: process.env.NODE_ENV || 'development' });
  });

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start API', err);
  process.exit(1);
});
