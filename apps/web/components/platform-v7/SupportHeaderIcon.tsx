'use client';

import Link from 'next/link';
import { LifeBuoy, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SupportHeaderIcon() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('pc-theme');
    const next = stored === 'dark' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('pc-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  return (
    <div className='p7-header-utilities' aria-label='Быстрые действия'>
      <style>{`
        .p7-header-utilities{display:none}
        @media(max-width:767px){
          .pc-v4-search{display:none!important}
          .pc-v4-actions button[aria-label='Уведомления'],
          .pc-v4-actions > div:nth-of-type(1){display:none!important}
          .pc-v4-actions > div:nth-of-type(2){display:inline-flex!important;flex:0 0 auto!important}
          .pc-v4-actions > div:nth-of-type(2) button[aria-label='Идентификация и настройки']{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;padding:4px!important;border-radius:13px!important;overflow:hidden!important;justify-content:center!important}
          .pc-v4-actions > div:nth-of-type(2) button[aria-label='Идентификация и настройки'] > span:nth-child(2),
          .pc-v4-actions > div:nth-of-type(2) button[aria-label='Идентификация и настройки'] > svg{display:none!important}
          .pc-v4-actions > div:nth-of-type(2) button[aria-label='Идентификация и настройки'] > span:first-child{width:28px!important;height:28px!important;font-size:9px!important}
          .pc-shell-root-v4 > div[aria-hidden='true']{background:rgba(15,23,42,.05)!important;backdrop-filter:none!important}
          .pc-v4-drawer{width:min(344px,84vw)!important;max-width:84vw!important;border-top-right-radius:24px!important;border-bottom-right-radius:24px!important;overflow:hidden!important}
          .p7-header-utilities{position:fixed;top:calc(env(safe-area-inset-top) + 7px);right:58px;z-index:105;display:flex;gap:6px;pointer-events:auto}
          .p7-header-utilities__button{width:42px;height:42px;border-radius:13px;border:1px solid var(--pc-border,#e4e6ea);background:var(--pc-bg-card,#fff);color:var(--pc-text-primary,#0f1419);display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 8px 18px rgba(15,23,42,.06);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .p7-header-utilities__button:active{transform:translateY(1px)}
        }
        @media(max-width:374px){
          .p7-header-utilities{right:56px;gap:5px}
          .p7-header-utilities__button{width:40px;height:40px}
          .pc-v4-actions > div:nth-of-type(2) button[aria-label='Идентификация и настройки']{width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important}
        }
      `}</style>
      <button type='button' className='p7-header-utilities__button' onClick={toggleTheme} aria-label={theme === 'dark' ? 'Включить светлый режим' : 'Включить ночной режим'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <Link href='/platform-v7/support' className='p7-header-utilities__button' aria-label='Поддержка'>
        <LifeBuoy size={18} />
      </Link>
    </div>
  );
}
