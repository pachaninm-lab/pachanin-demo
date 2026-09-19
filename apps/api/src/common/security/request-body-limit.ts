import type { NestExpressApplication } from '@nestjs/platform-express';

export const DEFAULT_API_BODY_LIMIT_BYTES = 1024 * 1024;
export const HARD_API_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

type BodyParserApplication = Pick<NestExpressApplication, 'useBodyParser'>;

export function resolveApiBodyLimitBytes(
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const configured = Number(environment.API_BODY_MAX_BYTES ?? DEFAULT_API_BODY_LIMIT_BYTES);
  if (!Number.isSafeInteger(configured) || configured < 1024) {
    return DEFAULT_API_BODY_LIMIT_BYTES;
  }
  return Math.min(configured, HARD_API_BODY_LIMIT_BYTES);
}

export function configureRequestBodyLimits(
  app: BodyParserApplication,
  environment: NodeJS.ProcessEnv = process.env,
): number {
  const limit = resolveApiBodyLimitBytes(environment);
  app.useBodyParser('json', { limit });
  app.useBodyParser('urlencoded', { limit, extended: true });
  return limit;
}
