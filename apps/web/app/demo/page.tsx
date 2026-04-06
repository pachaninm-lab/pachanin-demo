'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEMO_ROLES = [
  { role: 'FARMER',          email: 'farmer@demo.ru',      label: 'Фермер',          icon: '🌾', color: '#16a34a', desc: 'Создаёт лоты, участвует в торгах, ведёт сделку до расчёта.',           firstPage: '/lots' },
  { role: 'BUYER',           email: 'buyer@demo.ru',       label: 'Покупатель',       icon: '🏢', color: '#2563eb', desc: 'Закупает зерно, управляет dispatch, контролирует качество и платежи.', firstPage: '/deals' },
  { role: 'LOGISTICIAN',     email: 'logistics@demo.ru',   label: 'Логист',           icon: '🚛', color: '#7c3aed', desc: 'Планирует маршруты, контролирует рейсы и очередь приёмки.',            firstPage: '/dispatch' },
  { role: 'DRIVER',          email: 'driver@demo.ru',      label: 'Водитель',         icon: '🚚', color: '#b45309', desc: 'Подтверждает рейс, фиксирует чекпоинты, работает оффлайн.',            firstPage: '/driver-mobile' },
  { role: 'LAB',             email: 'lab@demo.ru',         label: 'Лаборатория',      icon: '🧪', color: '#0891b2', desc: 'Принимает пробы, выдаёт протоколы, переводит в settlement/dispute.',   firstPage: '/lab' },
  { role: 'ELEVATOR',        email: 'elevator@demo.ru',    label: 'Элеватор',         icon: '🏭', color: '#dc2626', desc: 'Управляет слотами очереди, весовой, выгрузкой и хранением.',           firstPage: '/receiving' },
  { role: 'ACCOUNTING',      email: 'accounting@demo.ru',  label: 'Бухгалтерия',      icon: '📊', color: '#0d9488', desc: 'Ведёт платёжный контур, финзаявки, выгрузку в 1С.',                   firstPage: '/payments' },
  { role: 'EXECUTIVE',       email: 'executive@demo.ru',   label: 'Руководитель',     icon: '📈', color: '#9333ea', desc: 'Аналитика, KPI, репутационные метрики платформы.',                    firstPage: '/analytics' },
  { role: 'SUPPORT_MANAGER', email: 'operator@demo.ru',    label: 'Оператор',         icon: '⚙️', color: '#ea580c', desc: 'Очереди, блокеры, споры, overrides — полный операционный контроль.',  firstPage: '/operator-cockpit' },
  { role: 'ADMIN',           email: 'admin@demo.ru',       label: 'Администратор',    icon: '🔑', color: '#64748b', desc: 'Полный доступ: роли, компании, коннекторы, аудит.',                   firstPage: '/cabinet' },
];

export default function DemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(email: string, firstPage: string) {
    setError(null);
    setLoading(email);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'demo1234' }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(firstPage);
      } else {
        setError(data.message || 'Ошибка входа');
      }
    } catch {
      setError('Нет соединения');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Hero */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 13, letterSpacing: '0.15em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 16 }}>
            Прозрачная Цена · Demo Platform
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, margin: '0 0 16px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Выберите роль и войдите
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 17, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            Полнофункциональный демо-стенд зерновой торговой платформы.
            Войдите одним кликом под любой ролью и проверьте весь цикл сделки.
          </p>
        </div>

        {error && (
          <div style={{ background: '#450a0a', border: '1px solid #991b1b', borderRadius: 10, padding: '12px 16px', marginBottom: 24, color: '#fca5a5', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Role grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {DEMO_ROLES.map((r) => {
            const isLoading = loading === r.email;
            return (
              <button
                key={r.email}
                onClick={() => loginAs(r.email, r.firstPage)}
                disabled={loading !== null}
                style={{
                  background: loading !== null && !isLoading ? 'rgba(30,41,59,0.5)' : 'rgba(30,41,59,0.9)',
                  border: `1px solid ${isLoading ? r.color : 'rgba(148,163,184,0.15)'}`,
                  borderRadius: 14,
                  padding: '18px 20px',
                  textAlign: 'left',
                  cursor: loading !== null ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isLoading ? `0 0 20px ${r.color}40` : 'none',
                  opacity: loading !== null && !isLoading ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 28, lineHeight: 1 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: r.color, fontFamily: 'monospace', marginTop: 2 }}>{r.role}</div>
                  </div>
                  {isLoading && (
                    <div style={{ marginLeft: 'auto', width: 18, height: 18, border: `2px solid ${r.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{r.desc}</div>
                <div style={{ marginTop: 12, fontSize: 12, color: '#475569' }}>→ {r.firstPage}</div>
              </button>
            );
          })}
        </div>

        {/* Info */}
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { icon: '🔐', title: 'Demo auth', text: 'Любой пароль. Cookie устанавливается автоматически.' },
            { icon: '💾', title: 'SEED данные', text: 'Все страницы показывают реалистичные данные.' },
            { icon: '📡', title: 'SSE Realtime', text: 'Живые события через Server-Sent Events.' },
            { icon: '📴', title: 'Offline queue', text: 'Действия сохраняются и синхронизируются при reconnect.' },
          ].map((item) => (
            <div key={item.title} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{item.text}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, color: '#334155', fontSize: 12 }}>
          Прозрачная Цена · Demo Stend · Все данные являются тестовыми
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
