import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { maskDeep, maskText } from '../security/sensitive-data';
import { encodeLogField } from '../security/log-encode';

/**
 * Log masking middleware per ТЗ 11.3 (152-ФЗ).
 *
 * Классификация чувствительных данных живёт не здесь, а в
 * common/security/sensitive-data.ts, и та же классификация применяется к
 * outbound-telemetry. Пока список был локальным, внутренние логи и Sentry
 * защищали одни и те же данные по-разному.
 *
 * Applied at the application level — intercepts outgoing response logging.
 *
 * Маскирование и кодирование — разные контроли, и здесь есть оба (V16.4.1).
 * Маскирование решает, ЧТО попадёт в строку; кодирование — какую ФОРМУ строке
 * позволено принять. Строка ниже собирается из шести полей, и три из них
 * вызывающий влияет: User-Agent, req.ip (при trust proxy он выводится из
 * X-Forwarded-For) и путь. Без кодирования их содержимое задаёт разметку
 * журнала, а не только его данные.
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

      // Кодируется КАЖДОЕ поле, а не одно названное в записи ASVS. Иначе
      // контроль держался бы на том, что остальные пять «вроде бы
      // безопасные», — а userId приходит из сессии, путь из URL, ip из
      // заголовка.
      //
      // res.statusCode приводится к числу: его присваивает обработчик, и
      // строку туда положить можно. duration не приводится — это
      // Date.now() - startMs, число по построению; приведение там нечем
      // отозвать мутацией, а контроль, который нельзя отозвать, — украшение.
      this.logger.log(
        `${encodeLogField(method)} ${encodeLogField(reqPath)} ${Number(res.statusCode)} ${duration}ms`
        + ` | ip=${encodeLogField(maskedIp)} user=${encodeLogField(userId)}`
        + ` ua="${encodeLogField(this.maskText(userAgent))}"`,
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
