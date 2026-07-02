/**
 * Sentry server-side конфигурация для Next.js SSR.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `grainflow-web@${process.env.NEXT_PUBLIC_APP_VERSION || '3.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
    beforeSend(event) {
      // Не отправляем sensitive headers на сервере
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
}
