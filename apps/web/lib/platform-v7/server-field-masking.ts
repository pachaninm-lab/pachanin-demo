// SEC-003 (audit): серверная фильтрация чувствительных полей по роли.
//
// role-access.ts описывает, КАКИЕ поля запрещены роли (PLATFORM_V7_ROLE_FORBIDDEN_FIELDS).
// Маскирование на клиенте (DocumentPreviewGate и т.п.) скрывает их в UI, но не
// защищает API-ответ. Эта чистая утилита редактирует объект ПЕРЕД сериализацией
// на сервере, чтобы запрещённые поля не покидали границу.
//
// Подключение (owner-side, когда появится реальный API): обернуть полезную
// нагрузку ответа в platformV7MaskRecordForRole(record, role) на серверной
// границе. Бизнес-логика не меняется — это последний фильтр на выходе.

import {
  isPlatformV7FieldForbiddenForRole,
  PLATFORM_V7_ROLE_FORBIDDEN_FIELDS,
  type PlatformV7Role,
  type PlatformV7SensitiveField,
} from './role-access';

export type PlatformV7MaskMode = 'omit' | 'redact';

export const PLATFORM_V7_FIELD_REDACTION = '[restricted]' as const;

export interface PlatformV7MaskOptions {
  /** 'omit' удаляет ключ, 'redact' заменяет значение на маркер. По умолчанию 'redact'. */
  readonly mode?: PlatformV7MaskMode;
  /**
   * Сопоставление имён ключей объекта с каноническими чувствительными полями,
   * если они отличаются (напр. { bank_details: 'bankDetails' }). По умолчанию
   * ключ трактуется как чувствительное поле, если совпадает по имени.
   */
  readonly keyMap?: Readonly<Record<string, PlatformV7SensitiveField>>;
}

const SENSITIVE_FIELD_SET: ReadonlySet<string> = new Set<PlatformV7SensitiveField>([
  'phone',
  'email',
  'exactAddress',
  'fullLegalName',
  'bankDetails',
  'fullDocuments',
  'responsiblePerson',
  'driverContact',
  'carrierContact',
  'closedOfferTerms',
]);

function resolveSensitiveField(
  key: string,
  keyMap?: Readonly<Record<string, PlatformV7SensitiveField>>,
): PlatformV7SensitiveField | null {
  if (keyMap && key in keyMap) return keyMap[key];
  return SENSITIVE_FIELD_SET.has(key) ? (key as PlatformV7SensitiveField) : null;
}

/**
 * Возвращает поверхностную копию записи, в которой запрещённые роли
 * чувствительные поля удалены ('omit') или заменены маркером ('redact').
 * Чистая функция: исходный объект не мутируется.
 */
export function platformV7MaskRecordForRole<T extends Record<string, unknown>>(
  record: T,
  role: PlatformV7Role,
  options: PlatformV7MaskOptions = {},
): Partial<T> {
  const mode = options.mode ?? 'redact';
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    const sensitiveField = resolveSensitiveField(key, options.keyMap);
    if (sensitiveField && isPlatformV7FieldForbiddenForRole(role, sensitiveField)) {
      if (mode === 'omit') continue;
      result[key] = PLATFORM_V7_FIELD_REDACTION;
      continue;
    }
    result[key] = value;
  }

  return result as Partial<T>;
}

/** Применяет platformV7MaskRecordForRole к массиву записей. */
export function platformV7MaskRecordsForRole<T extends Record<string, unknown>>(
  records: readonly T[],
  role: PlatformV7Role,
  options: PlatformV7MaskOptions = {},
): Partial<T>[] {
  return records.map((record) => platformV7MaskRecordForRole(record, role, options));
}

/** Список чувствительных ключей записи, которые были бы скрыты для роли. */
export function platformV7RedactedKeysForRole(
  record: Record<string, unknown>,
  role: PlatformV7Role,
  keyMap?: Readonly<Record<string, PlatformV7SensitiveField>>,
): string[] {
  const redacted: string[] = [];
  for (const key of Object.keys(record)) {
    const sensitiveField = resolveSensitiveField(key, keyMap);
    if (sensitiveField && isPlatformV7FieldForbiddenForRole(role, sensitiveField)) {
      redacted.push(key);
    }
  }
  return redacted;
}

/** Полный набор запрещённых ролей чувствительных полей (из role-access.ts). */
export function platformV7ForbiddenFieldsForRole(role: PlatformV7Role): readonly PlatformV7SensitiveField[] {
  return PLATFORM_V7_ROLE_FORBIDDEN_FIELDS[role];
}
