import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Log masking middleware per ТЗ 11.3 (152-ФЗ).
 * Masks Personally Identifiable Information in request logs:
 * INN, OGRN, BIK, bank accounts, phone numbers, email addresses, card numbers.
 *
 * Applied at the application level — intercepts outgoing response logging.
 */

const MASK_RULES: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: 'inn-12', pattern: /\b(\d{2})\d{8}(\d{2})\b/g, replacement: '$1********$2' },
  { name: 'ogrn-15', pattern: /\b(\d{1})\d{11}(\d{3})\b/g, replacement: '$1***********$2' },
  { name: 'bik', pattern: /\b04\d{7}\b/g, replacement: '04*******' },
  { name: 'bank-account', pattern: /\b([0-9]{5})[0-9]{10}([0-9]{5})\b/g, replacement: '$1**********$2' },
  { name: 'phone-ru', pattern: /(\+?7|8)[\s\-]?\(?\d{3}\)?\s?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, replacement: '+7***XXXXX' },
  { name: 'email', pattern: /([a-zA-Z0-9._%+\-]{1,3})[a-zA-Z0-9._%+\-]+@([a-zA-Z0-9\-]+\.[a-zA-Z]{2,})/g, replacement: '$1***@$2' },
  { name: 'card-number', pattern: /\b(\d{4})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?(\d{4})\b/g, replacement: '$1 **** **** $2' },
  { name: 'passport-ru', pattern: /\b\d{4}[\s]?\d{6}\b/g, replacement: '**** ******' },
];

const SENSITIVE_BODY_FIELDS = new Set([
  'password', 'passwordHash', 'secret', 'token', 'refreshToken', 'accessToken',
  'inn', 'ogrn', 'passport', 'bankAccount', 'bik', 'cardNumber',
  'phoneNumber', 'email', 'address', 'apiKey', 'webhookSecret',
]);

const LOG_EXCLUDED_PATHS = ['/health', '/ready', '/metrics', '/version'];

@Injectable()
export class LogMaskingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, path: reqPath, ip } = req;

    if (LOG_EXCLUDED_PATHS.some((p) => reqPath.startsWith(p))) {
      return next();
    }

    const startMs = Date.now();
    const userAgent = req.headers['user-agent'] ?? '-';

    res.on('finish', () => {
      const duration = Date.now() - startMs;
      const userId = (req as any).user?.id ?? 'anon';
      const maskedIp = this.maskIp(ip ?? 'unknown');

      this.logger.log(
        `${method} ${reqPath} ${res.statusCode} ${duration}ms | ip=${maskedIp} user=${userId} ua="${this.maskText(userAgent)}"`,
      );
    });

    next();
  }

  /** Mask a text string applying all PII patterns */
  static maskText(text: string): string {
    let result = text;
    for (const rule of MASK_RULES) {
      result = result.replace(rule.pattern, rule.replacement);
    }
    return result;
  }

  /** Recursively mask sensitive fields in an object */
  static maskObject(obj: unknown, depth = 0): unknown {
    if (depth > 5) return obj;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return LogMaskingMiddleware.maskText(obj);
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => LogMaskingMiddleware.maskObject(item, depth + 1));

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_BODY_FIELDS.has(key)) {
        result[key] = typeof value === 'string' ? `[MASKED:${key}]` : '[MASKED]';
      } else {
        result[key] = LogMaskingMiddleware.maskObject(value, depth + 1);
      }
    }
    return result;
  }

  private maskText(text: string): string {
    return LogMaskingMiddleware.maskText(text);
  }

  private maskIp(ip: string): string {
    // Show only first two octets of IPv4
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
    return ip;
  }
}
