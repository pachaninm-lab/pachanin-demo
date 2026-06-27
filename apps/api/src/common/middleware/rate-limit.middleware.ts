import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateEntry {
  count: number;
  blockedUntil?: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 300;
const AUTH_MAX_ATTEMPTS = 5;
const AUTH_BLOCK_15MIN = 15 * 60_000;
const AUTH_BLOCK_24H = 24 * 60 * 60_000;
const AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/mfa/verify'];

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store = new Map<string, RateEntry>();
  private readonly authStore = new Map<string, { attempts: number; blockedUntil?: number }>();

  private cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > WINDOW_MS * 2) this.store.delete(key);
    }
    for (const [key, entry] of this.authStore.entries()) {
      if (entry.blockedUntil && now > entry.blockedUntil) this.authStore.delete(key);
    }
  }, 5 * 60_000);

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
    const now = Date.now();
    const path = req.path.toLowerCase();

    // Auth-specific brute force protection
    if (AUTH_PATHS.some(p => path.startsWith(p)) && req.method === 'POST') {
      const authEntry = this.authStore.get(ip) ?? { attempts: 0 };
      if (authEntry.blockedUntil && now < authEntry.blockedUntil) {
        const retryAfterSec = Math.ceil((authEntry.blockedUntil - now) / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(authEntry.blockedUntil / 1000)));
        throw new HttpException(
          { message: 'Слишком много попыток входа. Попробуйте позже.', retryAfterSec },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Intercept response to track failed login attempts
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          authEntry.attempts = (authEntry.attempts ?? 0) + 1;
          if (authEntry.attempts >= 10) {
            authEntry.blockedUntil = now + AUTH_BLOCK_24H;
          } else if (authEntry.attempts >= AUTH_MAX_ATTEMPTS) {
            authEntry.blockedUntil = now + AUTH_BLOCK_15MIN;
          }
          this.authStore.set(ip, authEntry);
        } else if (res.statusCode < 400) {
          this.authStore.delete(ip);
        }
        return originalJson(body);
      };
    }

    // General rate limiting per IP
    let entry = this.store.get(ip);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      entry = { count: 0, windowStart: now };
      this.store.set(ip, entry);
    }

    entry.count++;
    const remaining = Math.max(0, MAX_REQUESTS - entry.count);
    const resetAt = Math.ceil((entry.windowStart + WINDOW_MS) / 1000);

    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetAt));

    if (entry.count > MAX_REQUESTS) {
      const retryAfterSec = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      throw new HttpException(
        { message: 'Превышен лимит запросов. Попробуйте позже.', retryAfterSec },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
