import { ConsoleLogger, Injectable } from '@nestjs/common';
import { REDACTED, isSensitiveFieldName, maskText } from '../security/sensitive-data';

/**
 * Глобальный логгер приложения: он ставится в main.ts, outbox-worker.ts и
 * marketing-outbox-worker.ts, поэтому через него проходит каждый вызов
 * this.logger.* во всём API и в воркерах.
 *
 * Классификация чувствительных данных берётся из common/security/sensitive-data.ts
 * и не дублируется здесь. Раньше дублировалась: этот файл держал собственные
 * двенадцать шаблонов и знал семь имён ключей, тогда как каноническая
 * классификация знает около семидесяти имён с нормализацией регистра и
 * разделителей плюс восемь правил значений. Унификация, описанная в заголовке
 * sensitive-data.ts, охватила middleware и Sentry, а самый общий канал — этот —
 * остался на приватном списке.
 *
 * Ниже остаются ровно два локальных правила, и остаются осознанно: каноническая
 * классификация их не выражает, а выразить её средствами нельзя без ущерба.
 * См. RESIDUAL_PATTERNS.
 */

/**
 * Имя ключа решает судьбу значения целиком — та же дисциплина, что в maskDeep,
 * только применённая к уже сериализованной строке лога.
 *
 * Ключ и значение разбираются одним общим шаблоном, а решение принимает
 * isSensitiveFieldName. Так список имён остаётся один: добавленное в
 * каноническую классификацию имя начинает вычищаться здесь само, без правки
 * этого файла. Значение допускается и строковое, и скалярное без кавычек,
 * потому что «"password": 1234» — такая же утечка.
 */
const JSON_FIELD = /"((?:[^"\\]|\\.)+)"(\s*:\s*)(?:"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?|true|false|null))/gu;

function redactSensitiveFields(message: string): string {
  JSON_FIELD.lastIndex = 0;
  return message.replace(JSON_FIELD, (match, key: string, separator: string) => (
    isSensitiveFieldName(key) ? `"${key}"${separator}"${REDACTED}"` : match
  ));
}

/**
 * Эвристики, а не классификация, поэтому они живут здесь, а не в
 * SENSITIVE_VALUE_RULES.
 *
 * Десятизначный ИНН юридического лица и длинный непрозрачный токен нельзя
 * добавить в канонические правила значений: они применяются также к
 * outbound-telemetry и к строке доступа, и там «любое десятизначное число»
 * замаскировало бы в том числе unix-время в секундах. Здесь же контекст —
 * произвольный текст лога, и ложное срабатывание стоит дешевле пропуска.
 *
 * Оба правила перенесены без изменений из прежнего приватного списка. Если бы
 * их просто убрали вместе с остальными, переход на каноническую классификацию
 * оказался бы чистой потерей покрытия, а не выигрышем; это проверяется тестом
 * coverage floor, а не предполагается.
 */
const RESIDUAL_PATTERNS: Array<[RegExp, string | ((substring: string) => string)]> = [
  [/"\d{10,12}"/g, '"***INN***"'],
  [/\b[A-Z0-9]{16,}\b/g, (match: string) => (match.length > 20 ? '***REDACTED***' : match)],
];

/**
 * Порядок намеренный: сначала имя ключа целиком забирает значение, затем
 * шаблоны значений добирают чувствительное, попавшее в свободный текст, и
 * только потом работают эвристики — к этому моменту канонически распознанное
 * уже замаскировано и под них не попадает.
 */
function maskSensitive(message: string): string {
  let result = maskText(redactSensitiveFields(message));
  for (const [pattern, replacement] of RESIDUAL_PATTERNS) {
    pattern.lastIndex = 0;
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
