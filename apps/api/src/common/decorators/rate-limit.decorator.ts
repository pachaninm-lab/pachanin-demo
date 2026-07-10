import { SetMetadata, applyDecorators } from '@nestjs/common';

export const RATE_LIMIT_OPTIONS = 'rate_limit_options';

export type RateLimitOptions = {
  name?: string;
  limit?: number;
  windowSeconds?: number;
  limitEnv?: string;
  windowEnv?: string;
  scope?: 'ip' | 'user' | 'org';
  includeParams?: string[];
};

export const RateLimit = (options: RateLimitOptions) => applyDecorators(
  SetMetadata(RATE_LIMIT_OPTIONS, Object.freeze({
    ...options,
    includeParams: Object.freeze([...(options.includeParams ?? [])]),
  })),
);
