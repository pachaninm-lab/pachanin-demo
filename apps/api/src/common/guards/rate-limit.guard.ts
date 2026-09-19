import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  RATE_LIMIT_OPTIONS,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import type { RequestUser } from '../types/request-user';
import { RateLimitService } from '../security/rate-limit.service';
import { TrustedProxyService } from '../security/trusted-proxy';

type RateLimitedRequest = Request & {
  user?: RequestUser;
  params: Record<string, string | undefined>;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimits: RateLimitService,
    private readonly trustedProxy: TrustedProxyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    try {
      const routeName = this.routeName(options, context);
      const limit = this.positiveInteger(options.limitEnv, options.limit ?? 60, 1, 100_000);
      const windowSeconds = this.positiveInteger(options.windowEnv, options.windowSeconds ?? 60, 1, 86_400);
      const scope = options.scope ?? 'ip';
      const scopeValue = this.scopeValue(scope, request);
      const partitions = (options.includeParams ?? []).map((name) => {
        const value = String(request.params?.[name] ?? '-').slice(0, 256);
        return `${name}=${value}`;
      });
      const decision = await this.rateLimits.consume(
        routeName,
        [scope, scopeValue, ...partitions].join('|'),
        limit,
        windowSeconds,
      );
      const retryAfterSeconds = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));

      response.setHeader('RateLimit-Limit', String(decision.limit));
      response.setHeader('RateLimit-Remaining', String(decision.remaining));
      response.setHeader('RateLimit-Reset', String(retryAfterSeconds));
      response.setHeader('X-RateLimit-Limit', String(decision.limit));
      response.setHeader('X-RateLimit-Remaining', String(decision.remaining));
      response.setHeader('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));

      if (!decision.allowed) {
        response.setHeader('Retry-After', String(retryAfterSeconds));
        throw new HttpException(
          {
            code: 'RATE_LIMITED',
            message: 'Request rate limit exceeded.',
            retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Distributed rate-limit enforcement failed: ${this.errorMessage(error)}`);
      throw new ServiceUnavailableException({
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Critical request protection is temporarily unavailable.',
      });
    }
  }

  private scopeValue(scope: NonNullable<RateLimitOptions['scope']>, request: RateLimitedRequest): string {
    if (scope === 'ip') {
      const ip = this.trustedProxy.resolveRequestIp(request);
      if (!ip || ip === 'unknown') throw new Error('Trusted client IP is unavailable.');
      return ip;
    }
    if (scope === 'user') {
      if (!request.user?.id) throw new Error('Authenticated user is required for user-scoped rate limiting.');
      return request.user.id;
    }
    if (!request.user?.orgId) throw new Error('Authenticated organization is required for org-scoped rate limiting.');
    return request.user.orgId;
  }

  private routeName(options: RateLimitOptions, context: ExecutionContext): string {
    const explicit = String(options.name ?? '').trim().toLowerCase();
    const generated = `${context.getClass().name}:${context.getHandler().name}`
      .replace(/[^a-zA-Z0-9:_-]+/g, '-')
      .toLowerCase();
    return (explicit || generated).slice(0, 128);
  }

  private positiveInteger(envName: string | undefined, fallback: number, min: number, max: number): number {
    const raw = envName ? process.env[envName] : undefined;
    const parsed = raw === undefined || raw === '' ? fallback : Number(raw);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`Invalid rate-limit configuration${envName ? `: ${envName}` : ''}.`);
    }
    return parsed;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
