import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { maskDeep, maskText } from '../security/sensitive-data';

/**
 * Log masking middleware per ТЗ 11.3 (152-ФЗ).
 *
 * Классификация чувствительных данных живёт не здесь, а в
 * common/security/sensitive-data.ts, и та же классификация применяется к
 * outbound-telemetry. Пока список был локальным, внутренние логи и Sentry
 * защищали одни и те же данные по-разному.
 *
 * Applied at the application level — intercepts outgoing response logging.
 */

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
    return maskText(text);
  }

  /** Recursively mask sensitive fields in an object */
  static maskObject(obj: unknown, depth = 0): unknown {
    return maskDeep(obj, depth);
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
