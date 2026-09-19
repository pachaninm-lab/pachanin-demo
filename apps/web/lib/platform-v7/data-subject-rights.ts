// CMP-001 / CMP-002 (audit, 152-ФЗ): инструменты прав субъекта персональных
// данных — согласия, минимизация, экспорт и удаление по субъекту.
//
// Чистые функции поверх существующих моделей, БЕЗ изменения бизнес-логики и без
// хранилища: предназначены для подключения на онбординге/в кабинете и на
// API-границе, когда появится реальная БД (owner-side). До этого — каркас +
// тесты, фиксирующие контракт 152-ФЗ.

export type PlatformV7ConsentPurpose =
  | 'deal_execution'
  | 'kyc_aml'
  | 'contact_sharing'
  | 'analytics'
  | 'marketing';

export type PlatformV7ProcessingBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation';

export type PlatformV7ConsentStatus = 'granted' | 'withdrawn';

export interface PlatformV7Consent {
  readonly subjectId: string;
  readonly purpose: PlatformV7ConsentPurpose;
  readonly basis: PlatformV7ProcessingBasis;
  readonly status: PlatformV7ConsentStatus;
  readonly grantedAt: string;
  readonly withdrawnAt?: string;
}

// Поля, которые считаются персональными данными при экспорте/удалении субъекта.
export const PLATFORM_V7_PERSONAL_DATA_KEYS = [
  'phone',
  'email',
  'exactAddress',
  'fullLegalName',
  'bankDetails',
  'responsiblePerson',
  'driverContact',
  'carrierContact',
  'passport',
  'inn',
  'birthDate',
] as const;

export type PlatformV7PersonalDataKey = (typeof PLATFORM_V7_PERSONAL_DATA_KEYS)[number];

export const PLATFORM_V7_ERASURE_MARKER = '[erased]' as const;

const PERSONAL_DATA_SET: ReadonlySet<string> = new Set(PLATFORM_V7_PERSONAL_DATA_KEYS);

// Минимизация: какие ПД-поля оправданы для каждой цели обработки.
const PURPOSE_ALLOWED_FIELDS: Record<PlatformV7ConsentPurpose, readonly PlatformV7PersonalDataKey[]> = {
  deal_execution: ['fullLegalName', 'inn', 'responsiblePerson', 'phone', 'email'],
  kyc_aml: ['fullLegalName', 'inn', 'passport', 'birthDate', 'exactAddress', 'bankDetails'],
  contact_sharing: ['phone', 'email', 'responsiblePerson', 'driverContact', 'carrierContact'],
  analytics: [],
  marketing: ['email'],
};

// --- Согласия (consent) ---

export function platformV7RecordConsent(
  subjectId: string,
  purpose: PlatformV7ConsentPurpose,
  basis: PlatformV7ProcessingBasis,
  grantedAt: string,
): PlatformV7Consent {
  return { subjectId, purpose, basis, status: 'granted', grantedAt };
}

export function platformV7WithdrawConsent(consent: PlatformV7Consent, withdrawnAt: string): PlatformV7Consent {
  // Юр.обязательство/договорное основание нельзя «отозвать» как согласие.
  if (consent.basis !== 'consent') return consent;
  return { ...consent, status: 'withdrawn', withdrawnAt };
}

export function platformV7HasActiveConsent(
  consents: readonly PlatformV7Consent[],
  subjectId: string,
  purpose: PlatformV7ConsentPurpose,
): boolean {
  return consents.some(
    (c) =>
      c.subjectId === subjectId &&
      c.purpose === purpose &&
      (c.status === 'granted' || c.basis !== 'consent'),
  );
}

// --- Минимизация данных ---

export function platformV7IsFieldJustifiedForPurpose(
  purpose: PlatformV7ConsentPurpose,
  field: string,
): boolean {
  if (!PERSONAL_DATA_SET.has(field)) return true; // не-ПД поля не ограничиваем
  return (PURPOSE_ALLOWED_FIELDS[purpose] as readonly string[]).includes(field);
}

export function platformV7ExcessivePersonalDataKeys(
  purpose: PlatformV7ConsentPurpose,
  record: Record<string, unknown>,
): string[] {
  return Object.keys(record).filter(
    (key) => PERSONAL_DATA_SET.has(key) && !platformV7IsFieldJustifiedForPurpose(purpose, key),
  );
}

// --- Экспорт по субъекту (право на доступ) ---

export function platformV7CollectSubjectRecords<T extends Record<string, unknown>>(
  records: readonly T[],
  subjectId: string,
  subjectKey = 'subjectId',
): T[] {
  return records.filter((record) => record[subjectKey] === subjectId);
}

export function platformV7ExportSubjectData<T extends Record<string, unknown>>(
  records: readonly T[],
  subjectId: string,
  subjectKey = 'subjectId',
): { subjectId: string; exportedAt: string; records: T[] } {
  return {
    subjectId,
    exportedAt: new Date(0).toISOString(),
    records: platformV7CollectSubjectRecords(records, subjectId, subjectKey),
  };
}

// --- Удаление/обезличивание по субъекту (право на удаление) ---

export function platformV7EraseSubjectPersonalData<T extends Record<string, unknown>>(record: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = PERSONAL_DATA_SET.has(key) ? PLATFORM_V7_ERASURE_MARKER : value;
  }
  return result as Partial<T>;
}

export function platformV7PersonalDataKeysInRecord(record: Record<string, unknown>): string[] {
  return Object.keys(record).filter((key) => PERSONAL_DATA_SET.has(key));
}
