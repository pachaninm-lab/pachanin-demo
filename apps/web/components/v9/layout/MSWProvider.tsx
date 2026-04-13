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
  const [isMswReady, setIsMswReady] = React.useState(false);

  React.useEffect(() => {
    const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
      || localStorage.getItem('pc-session-v9')?.includes('"demoMode":true')
      || true; // default on

    if (demoMode) {
      startMSW().then(() => setIsMswReady(true));
    } else {
      setIsMswReady(true);
    }
  }, []);

  // Render the UI immediately — MSW boots in the background.
  // While the service worker is registering, API calls will fail and the
  // components' own skeletons / error states will handle the transition.
  return (
    <>
      {!isMswReady && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0,
            zIndex: 100,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            textAlign: 'center',
            color: '#D97706',
            background: 'rgba(217,119,6,0.08)',
            borderBottom: '1px solid rgba(217,119,6,0.25)',
            letterSpacing: '0.03em',
          }}
        >
          ⏳ Загрузка демо-данных...
        </div>
      )}
      {children}
    </>
  );
}
