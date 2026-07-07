'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CONTENT_SELECTORS = [
  '.pc-v7-public-entry',
  '.pc-shell-root-v4',
  '.p7-contact-page',
  '.p7-route-loading',
  '.p7-contact-layout',
  '[data-testid="platform-v7-root-execution-cockpit"]',
  '[data-testid="platform-v7-question-form-page"]',
] as const;

function hasVisiblePlatformContent(): boolean {
  if (typeof document === 'undefined') return true;

  for (const selector of CONTENT_SELECTORS) {
    const node = document.querySelector<HTMLElement>(selector);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0) return true;
  }

  const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
  return text.length >= 48;
}

export function PlatformV7BlankScreenGuard() {
  const [blank, setBlank] = useState(false);

  useEffect(() => {
    let disposed = false;

    const check = () => {
      if (disposed) return;
      setBlank(!hasVisiblePlatformContent());
    };

    const timers = [1200, 2500, 4200].map((delay) => window.setTimeout(check, delay));
    const observer = new MutationObserver(() => window.requestAnimationFrame(check));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    window.addEventListener('pageshow', check);
    window.addEventListener('focus', check);

    return () => {
      disposed = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      window.removeEventListener('pageshow', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!blank) return null;

  return (
    <aside className='p7-blank-screen-recovery' role='alert' aria-label='Восстановление экрана платформы'>
      <style>{css}</style>
      <section>
        <span>Экран не загрузился</span>
        <h2>Можно перейти в стабильную точку входа</h2>
        <p>Если страница зависла после выхода, обновления или смены раздела, используйте один из безопасных маршрутов ниже.</p>
        <div>
          <button type='button' onClick={() => window.location.reload()}>Обновить</button>
          <Link href='/platform-v7/login?recovery=1'>Войти</Link>
          <Link href='/platform-v7'>Главная</Link>
        </div>
      </section>
    </aside>
  );
}

const css = `
.p7-blank-screen-recovery{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:calc(env(safe-area-inset-top,0px) + 16px) 14px calc(env(safe-area-inset-bottom,0px) + 16px);background:linear-gradient(180deg,#f7faf7,#fff);color:#071611;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.p7-blank-screen-recovery section{width:min(100%,520px);display:grid;gap:12px;padding:22px;border:1px solid rgba(7,22,17,.10);border-radius:26px;background:#fff;box-shadow:0 22px 60px rgba(7,22,17,.12)}.p7-blank-screen-recovery span{width:fit-content;padding:7px 10px;border-radius:999px;background:rgba(8,122,59,.08);color:#087a3b;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.06em}.p7-blank-screen-recovery h2{margin:0;font-size:clamp(24px,7vw,36px);line-height:1.03;letter-spacing:-.045em}.p7-blank-screen-recovery p{margin:0;color:#52615b;font-size:14px;line-height:1.45;font-weight:650}.p7-blank-screen-recovery div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.p7-blank-screen-recovery a,.p7-blank-screen-recovery button{min-height:46px;border-radius:15px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:13px;font-weight:950;cursor:pointer}.p7-blank-screen-recovery button{border:1px solid rgba(8,122,59,.20);background:#fff;color:#087a3b}.p7-blank-screen-recovery a{border:1px solid rgba(7,22,17,.10);background:#f6fbf8;color:#071611}.p7-blank-screen-recovery a:first-of-type{background:#087a3b;border-color:#087a3b;color:#fff}@media(max-width:380px){.p7-blank-screen-recovery section{padding:18px}.p7-blank-screen-recovery div{grid-template-columns:1fr}}
`;
