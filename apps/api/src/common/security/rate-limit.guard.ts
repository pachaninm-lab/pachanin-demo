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

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly trustedCidrs: TrustedCidr[];

  constructor(
    private readonly reflector: Reflector,
    private readonly service: RateLimitService,
  ) {
    this.trustedCidrs = parseTrustedProxyCidrs();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: RequestUser }>();
    const response = http.getResponse<Response>();
    const path = request.path || request.url.split('?', 1)[0];
    if (BYPASS_PATHS.has(path)) return true;

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]) ?? {};
    const policy = options.name || 'general';
    const limit = envInteger(options.limitEnv, options.limit ?? defaultLimit(policy), 1, 100_000);
    const windowSeconds = envInteger(options.windowEnv, options.windowSeconds ?? 60, 1, 86_400);
    const clientIp = resolveClientAddress(request, this.trustedCidrs);
    const scope = options.scope ?? 'ip';
    const subject = this.subject(scope, request.user, clientIp);
    const decision = await this.service.consume({
      policy,
      scope,
      subject,
      limit,
      windowSeconds,
      blockSeconds: policy.startsWith('auth_') ? windowSeconds : 0,
    });

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

  private subject(scope: RateLimitOptions['scope'], user: RequestUser | undefined, clientIp: string): string {
    if (scope === 'user') return user?.id || `ip:${clientIp}`;
    if (scope === 'org') return user?.orgId || `ip:${clientIp}`;
    return clientIp;
  }
}

function defaultLimit(policy: string): number {
  if (policy.startsWith('auth_')) return 10;
  return 300;
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
