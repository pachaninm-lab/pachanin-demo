/**
 * Каноническая классификация данных проекта.
 *
 * Утверждена владельцем как единственный источник истины для кода, тестов,
 * маскирования, минимизации в ИИ-контуре, outbound telemetry, границы
 * аналитики, инвентаря секретов, ASVS-доказательств и политик.
 *
 * До неё в платформе существовали три несовпадающие классификации: восемь
 * классов значений в маскировании логов, одиннадцать имён ключей в
 * минимизаторе ассистента и двадцать два имени секретов в инвентаре. Они
 * расходились потому, что правила не было. Теперь правило есть, и расхождение
 * ловится тестом: каждое имя поля обязано отображаться ровно в один
 * канонический класс, и ни один downstream-контроль не может пропустить класс
 * из-за несовпадения терминологии.
 *
 * Машиночитаемый источник — docs/security/data-classification.json. Этот
 * модуль обязан ему соответствовать, и тест сравнивает их побайтово по
 * идентификаторам и правилам обращения.
 */

export const DATA_CLASS_IDS = [
  'C0_PUBLIC_NON_PD',
  'C1_INTERNAL_NON_PD',
  'C2_BUSINESS_CONFIDENTIAL',
  'C3_PD_BASIC',
  'C4_PD_ACCOUNT',
  'C5_PD_IDENTITY',
  'C6_PD_FINANCIAL',
  'C7_PD_OPERATIONAL',
  'C8_PD_SPECIAL',
  'C9_PD_BIOMETRIC',
  'C10_AUTH_SECRET',
  'C11_CRYPTO_SECRET',
] as const;

export type DataClassId = (typeof DATA_CLASS_IDS)[number];

/** Классы, запрещённые в текущем scope продукта. */
export const PROHIBITED_CLASSES: readonly DataClassId[] = Object.freeze([
  'C8_PD_SPECIAL',
  'C9_PD_BIOMETRIC',
]);

/**
 * Классы, значение которых обязано вычищаться из outbound-каналов.
 *
 * Выведено из решения владельца: C10/C11 — никогда наружу; C5–C9 —
 * редактировать в логах, outbound telemetry, breadcrumbs и error payloads;
 * C3/C4 — редактировать в outbound telemetry и внешних каналах, где они не
 * обязательны. C2 добавлен решением о retention/DB-шифровании/целостности и
 * outbound-правиле для C2: коммерчески чувствительные значения не должны
 * попадать в Sentry так же, как не должны попадать в session replay —
 * решение уже действовавшее для аналитики, распространённое на этот канал.
 */
export const OUTBOUND_REDACTED_CLASSES: readonly DataClassId[] = Object.freeze([
  'C2_BUSINESS_CONFIDENTIAL',
  'C3_PD_BASIC',
  'C4_PD_ACCOUNT',
  'C5_PD_IDENTITY',
  'C6_PD_FINANCIAL',
  'C7_PD_OPERATIONAL',
  'C8_PD_SPECIAL',
  'C9_PD_BIOMETRIC',
  'C10_AUTH_SECRET',
  'C11_CRYPTO_SECRET',
]);

/** Классы, которым запрещено попадать в session replay и внешнюю аналитику. */
export const NEVER_REPLAY_CLASSES: readonly DataClassId[] = OUTBOUND_REDACTED_CLASSES;

/** Классы, которым запрещено находиться в query string. */
export const NEVER_QUERY_STRING_CLASSES: readonly DataClassId[] = Object.freeze([
  'C5_PD_IDENTITY',
  'C6_PD_FINANCIAL',
  'C7_PD_OPERATIONAL',
  'C8_PD_SPECIAL',
  'C9_PD_BIOMETRIC',
  'C10_AUTH_SECRET',
  'C11_CRYPTO_SECRET',
]);

export function isProhibitedClass(id: DataClassId): boolean {
  return PROHIBITED_CLASSES.includes(id);
}

export function isOutboundRedacted(id: DataClassId): boolean {
  return OUTBOUND_REDACTED_CLASSES.includes(id);
}
