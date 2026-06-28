import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/"password"\s*:\s*"[^"]*"/gi, '"password":"***"'],
  [/"token"\s*:\s*"[^"]*"/gi, '"token":"***"'],
  [/"accessToken"\s*:\s*"[^"]*"/gi, '"accessToken":"***"'],
  [/"refreshToken"\s*:\s*"[^"]*"/gi, '"refreshToken":"***"'],
  [/"secret"\s*:\s*"[^"]*"/gi, '"secret":"***"'],
  [/"apiKey"\s*:\s*"[^"]*"/gi, '"apiKey":"***"'],
  [/"hmacSecret"\s*:\s*"[^"]*"/gi, '"hmacSecret":"***"'],
  [/"\d{10,12}"/g, '"***INN***"'],  // INN (10-12 digits in quotes)
  [/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '****-****-****-****'],  // card numbers
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '***@***.***'],  // emails
  [/\+7\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}/g, '+7(***)*****'],  // RU phone
  [/\b[A-Z0-9]{16,}\b/g, (m: string) => m.length > 20 ? '***REDACTED***' : m],  // long API keys
];

function maskSensitive(message: string): string {
  let result = message;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement as string);
  }
  return result;
}

@Injectable()
export class MaskedLoggerService extends ConsoleLogger {
  log(message: any, ...optionalParams: any[]) {
    super.log(maskSensitive(String(message)), ...optionalParams.map(p => maskSensitive(String(p))));
  }

  error(message: any, ...optionalParams: any[]) {
    super.error(maskSensitive(String(message)), ...optionalParams.map(p => maskSensitive(String(p))));
  }

  warn(message: any, ...optionalParams: any[]) {
    super.warn(maskSensitive(String(message)), ...optionalParams.map(p => maskSensitive(String(p))));
  }

  debug(message: any, ...optionalParams: any[]) {
    super.debug(maskSensitive(String(message)), ...optionalParams.map(p => maskSensitive(String(p))));
  }

  verbose(message: any, ...optionalParams: any[]) {
    super.verbose(maskSensitive(String(message)), ...optionalParams.map(p => maskSensitive(String(p))));
  }
}
