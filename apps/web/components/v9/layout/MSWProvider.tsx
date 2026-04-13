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
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
      || localStorage.getItem('pc-session-v10')?.includes('"demoMode":true')
      || true; // default on

    if (demoMode) {
      startMSW().then(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  if (!ready) {
    return (
      <div className="v9-root" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6B778C', fontSize: 13 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid #E4E6EA', borderTopColor: '#0A7A5F',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          Инициализация...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}
