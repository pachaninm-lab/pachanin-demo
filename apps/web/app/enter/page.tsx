'use client';

const ROLES = [
  { slug: 'farmer', label: 'Фермер', icon: '🌾', to: '/lots' },
  { slug: 'buyer', label: 'Покупатель', icon: '🏢', to: '/deals' },
  { slug: 'operator', label: 'Оператор', icon: '⚙️', to: '/operator-cockpit' },
  { slug: 'admin', label: 'Админ', icon: '🔑', to: '/cabinet' },
  { slug: 'lab', label: 'Лаборатория', icon: '🧪', to: '/lab' },
  { slug: 'accounting', label: 'Бухгалтерия', icon: '📊', to: '/payments' },
];

export default function EnterPage() {
  function openRole(slug: string, to: string) {
    window.location.href = `/api/auth/demo/role/${slug}?to=${encodeURIComponent(to)}`;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #020817 0%, #0b1228 100%)', color: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: 'rgba(15, 23, 42, 0.88)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 24, padding: '28px 18px 18px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Демо-вход</h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, color: '#94a3b8', lineHeight: 1.5 }}>
            Выберите роль. Вход выполнится без пароля.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ROLES.map((role) => (
            <button
              key={role.slug}
              onClick={() => openRole(role.slug, role.to)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderRadius: 14,
                border: '1px solid rgba(148,163,184,0.18)',
                background: '#1e293b',
                color: '#f8fafc',
                fontSize: 15,
                fontWeight: 700,
                padding: '16px 14px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 24 }}>{role.icon}</span>
              <span>{role.label}</span>
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="/demo" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>
            Полный экран ролей →
          </a>
        </div>
      </div>
    </div>
  );
}
