/**
 * Sentry client-side конфигурация для Next.js.
 * Файл автоматически подхватывается @sentry/nextjs.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `grainflow-web@${process.env.NEXT_PUBLIC_APP_VERSION || '3.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.05,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: false,
      }),
    ],
    beforeSend(event) {
      // Маскируем ПДн в браузерных ошибках
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
        for (const key of ['password', 'inn', 'passport', 'phone', 'token']) {
          if (key in data) data[key] = '[Filtered]';
        }
      }
      return event;
    },
  });
}
