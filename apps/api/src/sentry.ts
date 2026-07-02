/**
 * Sentry error tracking для NestJS API.
 * Инициализируется в main.ts перед bootstrap().
 */

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENV = process.env.NODE_ENV || 'development';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENV,
    release: `grainflow-api@${process.env.APP_VERSION || '3.0.0'}`,
    tracesSampleRate: ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      // Маскируем ПДн в данных ошибок
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        for (const key of ['password', 'token', 'inn', 'passport', 'phone']) {
          if (key in data) data[key] = '[Filtered]';
        }
      }
      return event;
    },
  });
}

export { Sentry };
