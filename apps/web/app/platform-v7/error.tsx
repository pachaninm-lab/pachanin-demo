'use client';

import Link from 'next/link';

export default function PlatformV7Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: 'calc(100dvh - 110px)', display: 'grid', alignItems: 'start', justifyItems: 'center', padding: '20px 16px 24px', background: '#f7faf7', color: '#071611', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', overflowX: 'hidden' }}>
      <section style={{ width: 'min(100%, 560px)', border: '1px solid rgba(7,22,17,.10)', borderRadius: 28, background: '#fff', boxShadow: '0 18px 44px rgba(7,22,17,.08)', padding: 24 }}>
        <strong style={{ display: 'block', fontSize: 26, lineHeight: 1.1, letterSpacing: '-.04em', marginBottom: 10 }}>Страница временно обновляется</strong>
        <p style={{ margin: '0 0 18px', color: '#5c6862', fontSize: 15, lineHeight: 1.45, fontWeight: 650 }}>Обновите страницу. Если ошибка повторяется, используйте вход в рабочий контур напрямую.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type='button' onClick={reset} style={{ minHeight: 48, padding: '0 18px', borderRadius: 16, border: '1px solid rgba(0,122,47,.18)', background: '#fff', color: '#087a3b', fontWeight: 950, cursor: 'pointer' }}>Повторить</button>
          <Link href='/platform-v7/login' style={{ minHeight: 48, padding: '0 18px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#087a3b', color: '#fff', textDecoration: 'none', fontWeight: 950 }}>Перейти ко входу</Link>
        </div>
      </section>
    </main>
  );
}
