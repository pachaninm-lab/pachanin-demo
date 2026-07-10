import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_OPTIONS, RateLimitOptions } from '../decorators/rate-limit.decorator';
import type { RequestUser } from '../types/request-user';
import { parseTrustedProxyCidrs, resolveClientAddress, TrustedCidr } from './client-address';
import { RateLimitService } from './rate-limit.service';

const BYPASS_PATHS = new Set(['/health', '/ready', '/version', '/metrics']);

abstract class BaseRateLimitGuard {
  protected readonly trustedCidrs: TrustedCidr[];

  constructor(protected readonly service: RateLimitService) {
    this.trustedCidrs = parseTrustedProxyCidrs();
  }

  protected requestContext(context: ExecutionContext) {
    if (context.getType() !== 'http') return null;
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: RequestUser }>();
    const response = http.getResponse<Response>();
    const path = request.path || request.url.split('?', 1)[0];
    if (BYPASS_PATHS.has(path)) return null;
    return { request, response, clientIp: resolveClientAddress(request, this.trustedCidrs) };
  }

  protected enforce(
    response: Response,
    decision: Awaited<ReturnType<RateLimitService['consume']>>,
  ): true {
    setRateHeaders(response, decision.limit, decision.remaining, decision.resetAt);
    if (!decision.allowed) {
      const retryAfter = Math.max(1, decision.retryAfterSeconds);
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Слишком много запросов. Попробуйте позже.',
          retryAfterSec: retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}

@Injectable()
export class PreAuthRateLimitGuard extends BaseRateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resolved = this.requestContext(context);
    if (!resolved) return true;
    const limit = envInteger('RATE_LIMIT_GENERAL', 300, 1, 100_000);
    const windowSeconds = envInteger('RATE_LIMIT_GENERAL_WINDOW_SECONDS', 60, 1, 86_400);
    const decision = await this.service.consume({
      policy: 'general',
      scope: 'ip',
      subject: resolved.clientIp,
      limit,
      windowSeconds,
    });
    return this.enforce(resolved.response, decision);
  }
}

@Injectable()
export class DecoratedRateLimitGuard extends BaseRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    service: RateLimitService,
  ) {
    super(service);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;
    const resolved = this.requestContext(context);
    if (!resolved) return true;

    const policy = options.name || 'route';
    const limit = envInteger(options.limitEnv, options.limit ?? 10, 1, 100_000);
    const windowSeconds = envInteger(options.windowEnv, options.windowSeconds ?? 60, 1, 86_400);
    const scope = options.scope ?? 'ip';
    const subject = subjectFor(scope, resolved.request.user, resolved.clientIp);
    const decision = await this.service.consume({
      policy,
      scope,
      subject,
      limit,
      windowSeconds,
      blockSeconds: policy.startsWith('auth_') ? windowSeconds : 0,
    });
    return this.enforce(resolved.response, decision);
  }
}

function subjectFor(scope: RateLimitOptions['scope'], user: RequestUser | undefined, clientIp: string): string {
  if (scope === 'user') return user?.id || `ip:${clientIp}`;
  if (scope === 'org') return user?.orgId || `ip:${clientIp}`;
  return clientIp;
}

function envInteger(name: string | undefined, fallback: number, min: number, max: number): number {
  const candidate = name ? Number(process.env[name]) : Number.NaN;
  const value = Number.isFinite(candidate) ? candidate : fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function setRateHeaders(response: Response, limit: number, remaining: number, resetAt: number): void {
  const resetSeconds = Math.ceil(resetAt / 1000);
  response.setHeader('RateLimit-Limit', String(limit));
  response.setHeader('RateLimit-Remaining', String(remaining));
  response.setHeader('RateLimit-Reset', String(resetSeconds));
  response.setHeader('X-RateLimit-Limit', String(limit));
  response.setHeader('X-RateLimit-Remaining', String(remaining));
  response.setHeader('X-RateLimit-Reset', String(resetSeconds));
}
