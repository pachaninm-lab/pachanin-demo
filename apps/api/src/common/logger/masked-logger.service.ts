import { ConsoleLogger, Injectable } from '@nestjs/common';

const SENSITIVE_PATTERNS: Array<[RegExp, string | ((substring: string) => string)]> = [
  [/"password"\s*:\s*"[^"]*"/gi, '"password":"***"'],
  [/"token"\s*:\s*"[^"]*"/gi, '"token":"***"'],
  [/"accessToken"\s*:\s*"[^"]*"/gi, '"accessToken":"***"'],
  [/"refreshToken"\s*:\s*"[^"]*"/gi, '"refreshToken":"***"'],
  [/"secret"\s*:\s*"[^"]*"/gi, '"secret":"***"'],
  [/"apiKey"\s*:\s*"[^"]*"/gi, '"apiKey":"***"'],
  [/"hmacSecret"\s*:\s*"[^"]*"/gi, '"hmacSecret":"***"'],
  [/"\d{10,12}"/g, '"***INN***"'],
  [/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '****-****-****-****'],
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '***@***.***'],
  [/\+7\s?\(?\d{3}\)?\s?\d{3}-?\d{2}-?\d{2}/g, '+7(***)*****'],
  [/\b[A-Z0-9]{16,}\b/g, (match: string) => (match.length > 20 ? '***REDACTED***' : match)],
];

function maskSensitive(message: string): string {
  let result = message;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement as any);
  }
  return result;
}

function maskParams(params: any[]): string[] {
  return params.map((param) => maskSensitive(String(param)));
}

@Injectable()
export class MaskedLoggerService extends ConsoleLogger {
  log(message: any, ...optionalParams: any[]) {
    super.log(maskSensitive(String(message)), ...maskParams(optionalParams));
  }

  error(message: any, ...optionalParams: any[]) {
    super.error(maskSensitive(String(message)), ...maskParams(optionalParams));
  }

  warn(message: any, ...optionalParams: any[]) {
    super.warn(maskSensitive(String(message)), ...maskParams(optionalParams));
  }

  debug(message: any, ...optionalParams: any[]) {
    super.debug(maskSensitive(String(message)), ...maskParams(optionalParams));
  }

  verbose(message: any, ...optionalParams: any[]) {
    super.verbose(maskSensitive(String(message)), ...maskParams(optionalParams));
  }
}
