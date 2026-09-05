/**
 * Значения, которые пересекают границу запроса кабинета Гекты, объявлены здесь
 * один раз. DTO и сервис читают отсюда и не заводят своих копий: расхождение
 * двух списков — ровно тот дефект, который этот проход и закрывает (импорт
 * писал роль сообщения как есть, тогда как живой маршрут её нормализовал).
 */

export const GEKTA_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type GektaMessageRole = (typeof GEKTA_MESSAGE_ROLES)[number];

/**
 * LIFETIME сюда намеренно не входит: у него отдельный маршрут и отдельное
 * разрешение `entitlement.grant_lifetime`. Список — граница маршрута
 * `accounts/:id/grant`, а не перечень всех видов гранта.
 */
export const GEKTA_MANUAL_GRANT_KINDS = ['DAYS_7', 'DAYS_30', 'UNTIL_DATE'] as const;
export type GektaManualGrantKind = (typeof GEKTA_MANUAL_GRANT_KINDS)[number];

/**
 * Столбцы объявлены как VarChar: locale — 8 символов, role — 16. Граница
 * обязана держать тот же предел, иначе значение уходит в PostgreSQL и
 * возвращается ошибкой 22001, то есть пользовательский ввод становится 500.
 */
export const GEKTA_LOCALE_MAX = 8;
export const GEKTA_PROJECT_NAME_MAX = 60;
export const GEKTA_PROJECT_DESCRIPTION_MAX = 240;
export const GEKTA_CONVERSATION_TITLE_MAX = 80;
export const GEKTA_MESSAGE_BODY_MAX = 12_000;
export const GEKTA_PHONE_MAX = 32;
export const GEKTA_REASON_MAX = 500;

/**
 * Сколько импорт берёт за один запрос. Сервис режет по этим же числам, поэтому
 * клиент, приславший больше, раньше терял остаток молча: он получал ok и
 * помечал перенос выполненным.
 */
export const GEKTA_IMPORT_MAX_CONVERSATIONS = 60;
export const GEKTA_IMPORT_MAX_MESSAGES = 80;

/** Верхняя граница числа вложений и источников у одного сообщения. */
export const GEKTA_MESSAGE_ANNOTATION_MAX = 50;

/** Пробный период продлевается на срок в целых днях, не длиннее года. */
export const GEKTA_TRIAL_EXTENSION_MIN_DAYS = 1;
export const GEKTA_TRIAL_EXTENSION_MAX_DAYS = 365;
