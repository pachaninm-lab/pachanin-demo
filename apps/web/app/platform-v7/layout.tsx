import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AppShellV3 } from '@/components/v7r/AppShellV3';
import { ToastProvider } from '@/components/v7r/Toast';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';
import '@/styles/enterprise-ui.css';

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
  { label: 'Сбер', code: 'S', note: 'Банк и расчёты', bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  { label: 'СберКорус', code: 'K', note: 'Транспортные документы', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' },
  { label: 'ФГИС «Зерно»', code: 'Ф', note: 'Партия и регуляторный gate', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
  { label: 'ЕСИА', code: 'E', note: 'Идентификация и доступ', bg: 'rgba(71,85,105,0.08)', border: 'rgba(71,85,105,0.18)', color: '#334155' },
];

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const rawRole = headerStore.get('x-pc-role');
  const initialRole: PlatformRole = rawRole && VALID_ROLES.has(rawRole as PlatformRole) ? (rawRole as PlatformRole) : 'operator';

  return (
    <ToastProvider>
      <AppShellV3 initialRole={initialRole}>
        <>
          {children}

          <footer style={{ marginTop: 16, background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Контур и партнёры</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419' }}>Целевые системы и партнёрский слой</div>
              <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6, maxWidth: 920 }}>
                В футере показываем не обещания о закрытых live-интеграциях, а рабочий контур сделки и тех партнёров, вокруг которых строится исполнение: деньги, документы, регуляторный gate и идентификация.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {PARTNER_MARKS.map((item) => (
                <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center', background: item.bg, border: `1px solid ${item.border}`, color: item.color, fontWeight: 900, fontSize: 14 }}>
                    {item.code}
                  </div>
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F1419' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#6B778C' }}>{item.note}</div>
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
                    background: '#F8FAFB',
                    border: '1px solid #E4E6EA',
                    color: '#0F1419',
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
