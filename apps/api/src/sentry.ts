/**
 * Sentry error tracking для NestJS API.
 * Инициализируется в main.ts перед bootstrap().
 *
 * Sentry — канал, который уходит за пределы платформы, поэтому очистка здесь
 * не может быть слабее внутренней. Раньше она была: внутренний middleware
 * переписывал восемь классов персональных данных по шаблону, а этот обработчик
 * удалял пять литеральных имён ключей на верхнем уровне одного объекта — не
 * заходя ни в заголовки, где лежат Authorization и Cookie, ни в строку
 * запроса, ни во вложенные значения, ни в breadcrumbs.
 *
 * Теперь оба канала берут одну классификацию из
 * common/security/sensitive-data.ts, а тест перебирает её целиком и падает,
 * если какой-то класс перестал вычищаться отсюда.
 */

import * as Sentry from '@sentry/node';
import {
  isSensitiveFieldName,
  maskDeep,
  maskQueryString,
  maskText,
  maskUrl,
  REDACTED,
} from './common/security/sensitive-data';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENV = process.env.NODE_ENV || 'development';

type MutableEvent = Record<string, any>;

/**
 * Очистка события целиком.
 *
 * Экспортируется, чтобы тест мог прогнать через неё каждый класс из общей
 * классификации, а не проверять пример-другой.
 */
export function scrubSentryEvent<T>(event: T): T {
  const target = event as unknown as MutableEvent;
  if (!target || typeof target !== 'object') return event;

  const request = target.request as MutableEvent | undefined;
  if (request && typeof request === 'object') {
    if (request.data !== undefined) request.data = maskDeep(request.data);
    if (request.headers && typeof request.headers === 'object') {
      request.headers = maskDeep(request.headers);
    }
    if (request.cookies !== undefined) request.cookies = REDACTED;
    if (typeof request.query_string === 'string') {
      request.query_string = maskQueryString(request.query_string);
    } else if (request.query_string !== undefined) {
      request.query_string = maskDeep(request.query_string);
    }
    if (typeof request.url === 'string') request.url = maskUrl(request.url);
  }

  if (target.extra !== undefined) target.extra = maskDeep(target.extra);
  if (target.contexts !== undefined) target.contexts = maskDeep(target.contexts);
  if (target.tags !== undefined) target.tags = maskDeep(target.tags);
  if (typeof target.message === 'string') target.message = maskText(target.message);

  // Пользователь: идентификатор оставляем — без него событие бесполезно для
  // разбора, — всё остальное подчиняется общей классификации.
  if (target.user && typeof target.user === 'object') {
    const user = target.user as MutableEvent;
    for (const key of Object.keys(user)) {
      if (key === 'id') continue;
      user[key] = isSensitiveFieldName(key) ? REDACTED : maskDeep(user[key]);
    }
  }

  if (Array.isArray(target.breadcrumbs)) {
    target.breadcrumbs = target.breadcrumbs.map((crumb: MutableEvent) => {
      if (!crumb || typeof crumb !== 'object') return crumb;
      const next: MutableEvent = { ...crumb };
      if (typeof next.message === 'string') next.message = maskText(next.message);
      if (next.data !== undefined) next.data = maskDeep(next.data);
      return next;
    });
  }

  const values = target.exception?.values;
  if (Array.isArray(values)) {
    for (const value of values as MutableEvent[]) {
      if (value && typeof value.value === 'string') value.value = maskText(value.value);
    }
  }

  return event;
}

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    release: `grainflow-api@${process.env.APP_VERSION || '3.0.0'}`,
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
    // Персональные данные не собираются по умолчанию: их отправка должна быть
    // осознанным решением, а не побочным эффектом настроек SDK.
    sendDefaultPii: false,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (!breadcrumb) return breadcrumb;
      if (typeof breadcrumb.message === 'string') {
        breadcrumb.message = maskText(breadcrumb.message);
      }
      if (breadcrumb.data !== undefined) {
        breadcrumb.data = maskDeep(breadcrumb.data) as Record<string, unknown>;
      }
      return breadcrumb;
    },
  });
}

export { Sentry };
