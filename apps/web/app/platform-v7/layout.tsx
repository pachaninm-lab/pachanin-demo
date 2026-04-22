import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AppShellV3 } from '@/components/v7r/AppShellV3';
import { ToastProvider } from '@/components/v7r/Toast';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/app/v9.css';
import '@/app/v9-accessibility.css';
import '@/styles/theme.css';

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

export default async function PlatformV7Layout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const rawRole = headerStore.get('x-pc-role');
  const initialRole: PlatformRole = rawRole && VALID_ROLES.has(rawRole as PlatformRole) ? (rawRole as PlatformRole) : 'operator';

  return (
    <ToastProvider>
      <AppShellV3 initialRole={initialRole}>
        <>
          {children}

          <footer style={{ marginTop: 16, background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Контур и системы</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0F1419' }}>Целевые системы сделки</div>
              <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6, maxWidth: 920 }}>
                В футере показываем не обещания о закрытых боевых интеграциях, а рабочий контур и целевые системы, вокруг которых собирается сделка. Это честный демонстрационный слой, а не заявление, что все подключения уже live.
              </div>
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
