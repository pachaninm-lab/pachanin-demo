'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const MENU = [
  { title: 'Главная рынка', href: '/platform-v3' },
  { title: 'Роли', href: '/platform-v3/roles' },
  { title: 'Кабинет продавца', href: '/platform-v3/seller' },
  { title: 'Создать лот', href: '/platform-v3/seller/new-lot' },
  { title: 'Центр сделки', href: '/platform-v3/deal' },
  { title: 'Документы', href: '/platform-v3/documents' },
  { title: 'Логистика', href: '/platform-v3/logistics' },
  { title: 'Лаборатория', href: '/platform-v3/lab' },
  { title: 'Сценарии и имитации', href: '/platform-v3/simulations' },
];

function getRoleLabel(pathname: string) {
  if (pathname.startsWith('/platform-v3/seller')) return 'Фермер / продавец';
  if (pathname.startsWith('/platform-v3/logistics')) return 'Логист';
  if (pathname.startsWith('/platform-v3/lab')) return 'Лаборатория';
  if (pathname.startsWith('/platform-v3/documents')) return 'Документы';
  if (pathname.startsWith('/platform-v3/deal')) return 'Сделка';
  if (pathname.startsWith('/platform-v3/roles')) return 'Роли';
  if (pathname.startsWith('/platform-v3/simulations')) return 'Сценарии';
  return 'Рынок';
}

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const role = useMemo(() => getRoleLabel(pathname), [pathname]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#050914 0%,#071120 100%)', color: '#f8fafc' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, backdropFilter: 'blur(12px)', background: 'rgba(8,12,22,.9)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setOpen(true)}
            style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.03)', color: '#f8fafc', fontSize: 22, cursor: 'pointer' }}
            aria-label="Открыть меню"
          >
            ≡
          </button>
          <div style={{ flex: 1, color: '#22c55e', fontWeight: 900, fontSize: 20 }}>Прозрачная Цена</div>
          <div style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid rgba(34,197,94,.28)', color: '#22c55e', fontWeight: 800, fontSize: 14 }}>{role}</div>
          <div style={{ width: 42, height: 42, borderRadius: 21, background: 'rgba(34,197,94,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 900 }}>ПЦ</div>
        </div>
      </header>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(2,6,14,.62)' }} onClick={() => setOpen(false)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(88vw, 360px)', height: '100%', background: 'linear-gradient(180deg, rgba(10,15,27,.99) 0%, rgba(7,11,20,.99) 100%)', borderRight: '1px solid rgba(255,255,255,.08)', padding: '22px 16px', boxShadow: '0 18px 60px rgba(0,0,0,.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(34,197,94,.18)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22 }}>ПЦ</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>Прозрачная Цена</div>
                <div style={{ marginTop: 4, color: '#8ea0b7', fontSize: 14 }}>Единый контур сделки</div>
              </div>
            </div>
            <div style={{ color: '#8ea0b7', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Разделы платформы</div>
            <nav style={{ display: 'grid', gap: 8 }}>
              {MENU.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    style={{ textDecoration: 'none', color: active ? '#22c55e' : '#f8fafc', background: active ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.02)', border: active ? '1px solid rgba(34,197,94,.24)' : '1px solid rgba(255,255,255,.05)', borderRadius: 16, padding: '14px 14px', fontSize: 17, fontWeight: active ? 800 : 700 }}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </nav>
            <div style={{ marginTop: 18, padding: '14px 14px', borderRadius: 16, background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.16)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fbbf24' }}>Что внутри</div>
              <div style={{ marginTop: 8, color: '#cbd5e1', fontSize: 15, lineHeight: 1.5 }}>Рынок, офферы, сделка, рейсы, приёмка, лаборатория, документы, деньги и спор в одной системе.</div>
            </div>
          </aside>
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: '0 auto' }}>{children}</div>
    </div>
  );
}
