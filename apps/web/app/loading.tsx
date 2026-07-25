export default function Loading() {
  return (
    <main
      className='pc-root-loading'
      style={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#fbfcf9',
        color: '#071611',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      <section className='pc-root-loading-live' style={{ display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
        <div
          aria-hidden='true'
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            border: '4px solid rgba(8,122,59,.16)',
            borderTopColor: '#087a3b',
            animation: 'pcSpin .8s linear infinite',
          }}
        />
        <strong style={{ fontSize: 18, letterSpacing: '-.03em' }}>Загружаем платформу</strong>
        <span style={{ maxWidth: 320, fontSize: 13, lineHeight: 1.45, color: '#5e6b66' }}>
          Идёт открытие публичного контура «Прозрачная Цена».
        </span>
      </section>

      <noscript>
        <style>{'.pc-root-loading-live{display:none!important}.pc-root-loading-noscript{display:grid!important}'}</style>
        <section className='pc-root-loading-noscript' aria-labelledby='pc-nojs-title'>
          <strong id='pc-nojs-title'>Публичная форма защищена</strong>
          <p>Без JavaScript персональные данные здесь не собираются и не передаются. Продолжите через защищённую регистрацию или позвоните.</p>
          <p lang='en'>Without JavaScript, personal data is not collected or transmitted here. Continue through protected registration or call us.</p>
          <p lang='zh'>未启用 JavaScript 时，此页面不会收集或传输个人数据。请进入受保护的注册流程或致电联系我们。</p>
          <nav aria-label='Защищённая регистрация / Protected registration / 受保护的注册'>
            <a href='/platform-v7/register?entry=organization-connect&lang=ru'>RU · Защищённая регистрация</a>
            <a href='/platform-v7/register?entry=organization-connect&lang=en' lang='en'>EN · Protected registration</a>
            <a href='/platform-v7/register?entry=organization-connect&lang=zh' lang='zh'>中文 · 受保护的注册</a>
          </nav>
          <a className='pc-root-loading-call' href='tel:+79162778989'>Позвонить · Call · 致电</a>
        </section>
      </noscript>

      <style>{`
        @keyframes pcSpin{to{transform:rotate(360deg)}}
        .pc-root-loading,.pc-root-loading *{box-sizing:border-box}
        .pc-root-loading-noscript{display:none;width:min(100%,620px);gap:14px;padding:24px;border:1px solid rgba(8,122,59,.24);border-radius:22px;background:#fff;box-shadow:0 18px 44px rgba(7,22,17,.08)}
        .pc-root-loading-noscript strong{font-size:clamp(22px,5vw,34px);line-height:1.1;letter-spacing:-.03em}
        .pc-root-loading-noscript p{margin:0;color:#53645d;line-height:1.5}
        .pc-root-loading-noscript nav{display:grid;grid-template-columns:1fr;gap:10px}
        .pc-root-loading-noscript a{min-height:48px;display:flex;align-items:center;justify-content:center;padding:10px 14px;border:1px solid rgba(8,122,59,.24);border-radius:12px;color:#07572e;background:#f5faf7;font-weight:750;text-decoration:none;text-align:center}
        .pc-root-loading-noscript a:focus-visible{outline:3px solid rgba(8,122,59,.35);outline-offset:2px}
        .pc-root-loading-noscript .pc-root-loading-call{background:#087a3b;color:#fff}
        @media(min-width:640px){.pc-root-loading-noscript nav{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(prefers-reduced-motion:reduce){.pc-root-loading-live>div{animation:none!important}}
      `}</style>
    </main>
  );
}
