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
          .pc-v4-actions > div:first-of-type{display:none!important}
          .pc-shell-root-v4 > div[aria-hidden='true']{background:rgba(15,23,42,.18)!important;backdrop-filter:blur(2px)!important}
          .pc-v4-drawer{width:min(360px,86vw)!important;max-width:86vw!important;border-top-right-radius:22px!important;border-bottom-right-radius:22px!important;overflow:hidden!important}
          .p7-header-utilities{position:fixed;top:calc(env(safe-area-inset-top) + 7px);right:138px;z-index:105;display:flex;gap:6px;pointer-events:auto}
          .p7-header-utilities__button{width:42px;height:42px;border-radius:13px;border:1px solid var(--pc-border,#e4e6ea);background:var(--pc-bg-card,#fff);color:var(--pc-text-primary,#0f1419);display:inline-flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 8px 18px rgba(15,23,42,.06);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
          .p7-header-utilities__button:active{transform:translateY(1px)}
        }
        @media(max-width:374px){
          .p7-header-utilities{right:126px;gap:5px}
          .p7-header-utilities__button{width:40px;height:40px}
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
