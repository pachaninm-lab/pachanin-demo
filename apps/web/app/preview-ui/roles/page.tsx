import Link from 'next/link';

const roles = [
  { href: '/preview-ui/roles/farmer', icon: '🌾', title: 'Фермер / Продавец', text: 'Продажа зерна и масличных' },
  { href: '/preview-ui/roles/accounting', icon: '₽', title: 'Бухгалтерия', text: 'Платежи, ЭДО и сверки' },
  { href: '/preview-ui/roles/lab', icon: '🧪', title: 'Лаборатория', text: 'Анализы и протоколы качества' },
  { href: '/preview-ui/roles/logistics', icon: '🚛', title: 'Логист / Перевозчик', text: 'Рейсы, карта и контроль движения' },
];

export default function Page() {
  return (
    <main style={{ minHeight: '100vh', background: '#060b16', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 40px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 14 }}>Прозрачная Цена</div>
        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.02, fontWeight: 800 }}>Выберите роль</h1>
        <p style={{ margin: '14px 0 24px', color: '#94a3b8', fontSize: 16, lineHeight: 1.5 }}>Эталон мобильного кабинета: тёмный фон, зелёный акцент, крупные KPI, статусные пилюли и плотные кликабельные списки.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
          {roles.map((role) => (
            <Link key={role.href} href={role.href} style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 24, padding: 18, minHeight: 156, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(34,197,94,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{role.icon}</div>
              <div style={{ fontSize: 20, lineHeight: 1.1, fontWeight: 700 }}>{role.title}</div>
              <div style={{ color: '#8aa0b8', fontSize: 15, lineHeight: 1.35 }}>{role.text}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
