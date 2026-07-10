'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';

const ENDPOINT = '/api/telemetry/public-entry';
const RELEASE = process.env.NEXT_PUBLIC_RELEASE || process.env.NEXT_PUBLIC_COMMIT_SHA || 'unknown';
const ALLOWED_ROUTES = new Set([
  '/platform-v7',
  '/platform-v7/login',
  '/platform-v7/forgot-password',
  '/platform-v7/reset-password',
]);

type TelemetryPayload = {
  kind: 'web_vital' | 'client_error' | 'blank_screen';
  route: string;
  release: string;
  name?: string;
  value?: number;
  rating?: string;
  category?: string;
};

function safeRoute(pathname: string | null) {
  return pathname && ALLOWED_ROUTES.has(pathname) ? pathname : '/platform-v7/other';
}

function report(payload: TelemetryPayload) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const accepted = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      if (accepted) return;
    }
  } catch {}

  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    cache: 'no-store',
    credentials: 'same-origin',
  }).catch(() => undefined);
}

export function PublicEntryTelemetry() {
  const pathname = usePathname();
  const route = safeRoute(pathname);

  useReportWebVitals((metric) => {
    if (!['CLS', 'FCP', 'INP', 'LCP', 'TTFB'].includes(metric.name)) return;
    report({
      kind: 'web_vital',
      route,
      release: RELEASE,
      name: metric.name,
      value: Number(metric.value.toFixed(metric.name === 'CLS' ? 4 : 1)),
      rating: metric.rating,
    });
  });

  useEffect(() => {
    function onError(event: ErrorEvent) {
      const message = String(event.message || '');
      report({
        kind: 'client_error',
        route,
        release: RELEASE,
        category: /chunk|loading css chunk|dynamically imported module/i.test(message) ? 'chunk_load' : 'runtime',
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason instanceof Error ? `${event.reason.name}:${event.reason.message}` : String(event.reason || '');
      report({
        kind: 'client_error',
        route,
        release: RELEASE,
        category: /chunk|dynamically imported module/i.test(reason) ? 'chunk_load' : 'unhandled_rejection',
      });
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    const timer = window.setTimeout(() => {
      const main = document.querySelector('main');
      const textLength = main?.textContent?.trim().length || 0;
      const box = main?.getBoundingClientRect();
      const rendered = Boolean(box && box.width > 1 && box.height > 40);
      if (!main || textLength < 20 || !rendered) {
        report({ kind: 'blank_screen', route, release: RELEASE, category: 'main_not_rendered' });
      }
    }, 2_500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [route]);

  return null;
}
