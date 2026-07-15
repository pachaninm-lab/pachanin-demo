import { Body, Controller, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import {
  configureRequestBodyLimits,
  DEFAULT_API_BODY_LIMIT_BYTES,
  HARD_API_BODY_LIMIT_BYTES,
  resolveApiBodyLimitBytes,
} from './request-body-limit';

@Controller()
class PayloadProbeController {
  @Post('payload-probe')
  accept(@Body() body: { value?: string }) {
    return { acceptedBytes: Buffer.byteLength(body.value ?? '', 'utf8') };
  }
}

@Module({ controllers: [PayloadProbeController] })
class PayloadProbeModule {}

describe('request body size security boundary', () => {
  let app: NestExpressApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns HTTP 413 before an oversized JSON body reaches a controller', async () => {
    app = await NestFactory.create<NestExpressApplication>(PayloadProbeModule, {
      logger: false,
      bodyParser: false,
    });
    configureRequestBodyLimits(app, { API_BODY_MAX_BYTES: '1024' });
    await app.init();

    await request(app.getHttpServer())
      .post('/payload-probe')
      .send({ value: 'x'.repeat(2048) })
      .expect(413);
  });

  it('accepts a bounded JSON request through the same configured parser', async () => {
    app = await NestFactory.create<NestExpressApplication>(PayloadProbeModule, {
      logger: false,
      bodyParser: false,
    });
    configureRequestBodyLimits(app, { API_BODY_MAX_BYTES: '4096' });
    await app.init();

    await request(app.getHttpServer())
      .post('/payload-probe')
      .send({ value: 'bounded' })
      .expect(201)
      .expect({ acceptedBytes: 7 });
  });

  it('falls back safely and caps operator configuration', () => {
    expect(resolveApiBodyLimitBytes({ API_BODY_MAX_BYTES: 'invalid' })).toBe(
      DEFAULT_API_BODY_LIMIT_BYTES,
    );
    expect(resolveApiBodyLimitBytes({ API_BODY_MAX_BYTES: '1' })).toBe(
      DEFAULT_API_BODY_LIMIT_BYTES,
    );
    expect(resolveApiBodyLimitBytes({ API_BODY_MAX_BYTES: String(Number.MAX_SAFE_INTEGER) })).toBe(
      HARD_API_BODY_LIMIT_BYTES,
    );
  });
});
