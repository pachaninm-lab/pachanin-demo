'use client';

import { useEffect, useState } from 'react';

const ROLES = [
  { label: 'Фермер',     email: 'farmer@demo.ru',     icon: '🌾' },
  { label: 'Покупатель', email: 'buyer@demo.ru',       icon: '🏢' },
  { label: 'Логист',     email: 'logistics@demo.ru',   icon: '🚛' },
  { label: 'Водитель',   email: 'driver@demo.ru',      icon: '🚚' },
  { label: 'Лаборатория',email: 'lab@demo.ru',         icon: '🧪' },
  { label: 'Элеватор',   email: 'elevator@demo.ru',    icon: '🏭' },
  { label: 'Бухгалтерия',email: 'accounting@demo.ru',  icon: '📊' },
  { label: 'Руководитель',email:'executive@demo.ru',   icon: '📈' },
  { label: 'Оператор',   email: 'operator@demo.ru',    icon: '⚙️' },
  { label: 'Админ',      email: 'admin@demo.ru',       icon: '🔑' },
];

function readRoleFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const raw = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('pc_session_present='))?.split('=')[1];
  if (!raw) return '';
  try { return JSON.parse(decodeURIComponent(raw)).role || ''; } catch { return ''; }
}

export function DemoBanner() {
  const [role, setRole] = useState('');
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    setRole(readRoleFromCookie());
    // Poll for cookie changes (e.g. after role switch)
    const id = setInterval(() => setRole(readRoleFromCookie()), 2000);
    return () => clearInterval(id);
  }, []);

  if (!role) return null; // not logged in

  async function switchRole(email: string) {
    setSwitching(true);
    setOpen(false);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: '' }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      }
    } finally {
      setSwitching(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/demo';
  }

  const currentRole = ROLES.find((r) => {
    try { return document.cookie.includes(r.email.split('@')[0]); } catch { return false; }
  });

  return (
    <>
      {/* Fixed banner */}
      <div style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
        background: '#0f172a', border: '1px solid #334155',
        borderRadius: 12, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        fontSize: 13, color: '#e2e8f0',
        maxWidth: 320,
      }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Demo mode</div>
          <div style={{ fontWeight: 600, color: '#38bdf8' }}>{role}</div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={switching}
          style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#cbd5e1', fontSize: 12, fontWeight: 600 }}
        >
          {switching ? '…' : 'Сменить'}
        </button>
        <button
          onClick={logout}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16, padding: '2px 4px', lineHeight: 1 }}
          title="Выйти"
        >×</button>
      </div>

      {/* Role picker popup */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 72, left: 16, zIndex: 9999,
          background: '#0f172a', border: '1px solid #334155', borderRadius: 14,
          padding: 10, width: 260, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px 8px', fontWeight: 600 }}>
            Войти как
          </div>
          {ROLES.map((r) => {
            const active = role === r.email.split('@')[0].toUpperCase() || role.toLowerCase() === r.label.toLowerCase() || r.email.startsWith(role.toLowerCase());
            return (
              <button
                key={r.email}
                onClick={() => switchRole(r.email)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', textAlign: 'left',
                  background: active ? 'rgba(56,189,248,0.1)' : 'transparent',
                  border: 'none', borderRadius: 8,
                  padding: '8px 10px', cursor: 'pointer', color: '#e2e8f0', fontSize: 13,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 18 }}>{r.icon}</span>
                <span style={{ fontWeight: active ? 700 : 400, color: active ? '#38bdf8' : '#e2e8f0' }}>{r.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Click-away */}
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />}
    </>
  );
}
