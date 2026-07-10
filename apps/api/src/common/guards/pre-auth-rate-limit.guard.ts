import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimitService } from '../security/rate-limit.service';
import { TrustedProxyService } from '../security/trusted-proxy';

const BYPASS_PATHS = new Set(['/health', '/ready', '/version', '/metrics']);

@Injectable()
export class PreAuthRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(PreAuthRateLimitGuard.name);

  constructor(
    private readonly rateLimits: RateLimitService,
    private readonly trustedProxy: TrustedProxyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = request.path || request.url.split('?', 1)[0];
    if (BYPASS_PATHS.has(path)) return true;

    try {
      const clientIp = this.trustedProxy.resolveRequestIp(request);
      if (!clientIp || clientIp === 'unknown') {
        throw new Error('Trusted client IP is unavailable.');
      }
      const limit = this.positiveInteger('RATE_LIMIT_GENERAL', 300, 1, 100_000);
      const windowSeconds = this.positiveInteger('RATE_LIMIT_GENERAL_WINDOW_SECONDS', 60, 1, 86_400);
      const decision = await this.rateLimits.consume(
        'general_pre_auth',
        `ip|${clientIp}`,
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
      this.logger.error(`Pre-auth rate-limit enforcement failed: ${this.errorMessage(error)}`);
      throw new ServiceUnavailableException({
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Critical request protection is temporarily unavailable.',
      });
    }
  }

  private positiveInteger(envName: string, fallback: number, min: number, max: number): number {
    const raw = process.env[envName];
    const parsed = raw === undefined || raw === '' ? fallback : Number(raw);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new Error(`Invalid rate-limit configuration: ${envName}.`);
    }
    return parsed;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}
