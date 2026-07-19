'use client';
import * as React from 'react';

let mswStarted = false;

async function startMSW() {
  if (typeof window === 'undefined' || mswStarted) return;
  const { worker } = await import('@/mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
  mswStarted = true;
}

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [bannerVisible, setBannerVisible] = React.useState(false);

  React.useEffect(() => {
    const demoMode =
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
      localStorage.getItem('pc-session-v10')?.includes('"demoMode":true') ||
      localStorage.getItem('pc-session-v9r')?.includes('"demoMode":true') ||
      localStorage.getItem('pc-session-v9')?.includes('"demoMode":true');

    if (!demoMode) {
      // Production: never intercept real API calls with the mock worker. Also
      // remove any mock service worker a previous demo build registered in this
      // browser, so real /api/* requests (login, cabinet data) reach the server.
      if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) =>
            regs.forEach((r) => {
              if (r.active?.scriptURL?.includes('mockServiceWorker')) r.unregister();
            }),
          )
          .catch(() => undefined);
      }
      return;
    }

    setBannerVisible(true);
    startMSW()
      .catch(() => undefined)
      .finally(() => {
        window.setTimeout(() => setBannerVisible(false), 300);
      });
  }, []);

  return (
    <>
      {bannerVisible ? (
        <div
          className="v9-root"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            padding: '8px 12px',
            background: 'rgba(10,122,95,0.95)',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          Подключаем демонстрационные данные…
        </div>
      ) : null}
      {children}
    </>
  );
}
