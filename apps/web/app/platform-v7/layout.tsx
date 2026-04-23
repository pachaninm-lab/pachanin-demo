import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AppShellV3 } from '@/components/v7r/AppShellV3';
import { ToastProvider } from '@/components/v7r/Toast';
import { BrandMark } from '@/components/v7r/BrandMark';
import { AiShellEnhancer } from '@/components/v7r/AiShellEnhancer';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';
import '@/styles/design-fixes.css';

export const metadata: Metadata = {
  title: 'Прозрачная Цена',
  description: 'Цифровой контур исполнения сделки и операционного контроля',
};

const VALID_ROLES = new Set<PlatformRole>([
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
]);

const TARGET_SYSTEMS = ['ФГИС «Зерно»', 'ЕСИА', 'Сбер', 'СберКорус', 'ЭДО', 'Лаборатории'];

const PARTNER_MARKS = [
  { label: 'Сбер', code: 'S', note: 'Деньги и release', bg: 'rgba(126,242,196,0.10)', border: 'rgba(126,242,196,0.18)', color: '#7EF2C4' },
  { label: 'СберКорус', code: 'K', note: 'Транспортные документы', bg: 'rgba(92,158,255,0.10)', border: 'rgba(92,158,255,0.18)', color: '#93C5FD' },
  { label: 'ФГИС «Зерно»', code: 'Ф', note: 'Партия и регуляторный gate', bg: 'rgba(245,180,30,0.10)', border: 'rgba(245,180,30,0.18)', color: '#F5B41E' },
  { label: 'ЕСИА', code: 'E', note: 'Идентификация и доступ', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.10)', color: '#D6E2DD' },
];

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const rawRole = headerStore.get('x-pc-role');
  const initialRole: PlatformRole =
    rawRole && VALID_ROLES.has(rawRole as PlatformRole) ? (rawRole as PlatformRole) : 'operator';

  return (
    <ToastProvider>
      <AppShellV3 initialRole={initialRole}>
        <>
          <AiShellEnhancer />
          {children}

          <footer
            style={{
              marginTop: 18,
              background: 'var(--pc-shell-surface-strong)',
              border: '1px solid var(--pc-border)',
              borderRadius: 22,
              padding: 18,
              display: 'grid',
              gap: 14,
              boxShadow: 'var(--pc-shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                <BrandMark size={42} rounded={16} />
                <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
                    Контур и партнёры
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pc-text-primary)' }}>
                    Деньги, документы, идентификация и регуляторный gate
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', lineHeight: 1.6, maxWidth: 920 }}>
                    Внизу не обещания о закрытых live-интеграциях, а реальный рабочий контур: кто помогает удержать сделку внутри платформы, довести документы до юридической формы и не выпускать деньги без подтверждённых событий.
                  </div>
                </div>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent-strong)', fontSize: 12, fontWeight: 800 }}>
                Pilot-ready с сопровождением
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {PARTNER_MARKS.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderRadius: 16,
                    background: 'var(--pc-shell-surface)',
                    border: '1px solid var(--pc-border)',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      background: item.bg,
                      border: `1px solid ${item.border}`,
                      color: item.color,
                      fontWeight: 900,
                      fontSize: 14,
                    }}
                  >
                    {item.code}
                  </div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary)' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--pc-text-secondary)' }}>{item.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TARGET_SYSTEMS.map((item) => (
                <span
                  key={item}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: 'var(--pc-shell-surface-soft)',
                    border: '1px solid var(--pc-border)',
                    color: 'var(--pc-text-primary)',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </footer>
        </>
      </AppShellV3>
    </ToastProvider>
  );
}
