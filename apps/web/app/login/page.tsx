import Link from 'next/link';
import { redirect } from 'next/navigation';

const DEMO_ROLES = [
  { label: 'Фермер', email: 'farmer@demo.ru', to: '/canon/market' },
  { label: 'Покупатель', email: 'buyer@demo.ru', to: '/canon/deals' },
  { label: 'Бухгалтерия', email: 'accounting@demo.ru', to: '/canon/finance' },
  { label: 'Логистика', email: 'logistic@demo.ru', to: '/canon/operations' },
  { label: 'Лаборатория', email: 'lab@demo.ru', to: '/canon/quality' },
  { label: 'Оператор', email: 'operator@demo.ru', to: '/canon/control' },
  { label: 'Руководитель', email: 'executive@demo.ru', to: '/canon/analytics2' },
  { label: 'Элеватор', email: 'elevator@demo.ru', to: '/canon/receiving2' },
  { label: 'Водитель', email: 'driver@demo.ru', to: '/canon/mobile2' },
  { label: 'Администратор', email: 'admin@demo.ru', to: '/canon/admin' },
] as const;

function normalizeReturnTo(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith('/')) return '/';
  return raw;
}

function matchDemoRole(returnTo: string) {
  return DEMO_ROLES.find((item) => returnTo === item.to || returnTo.startsWith(`${item.to}/`));
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const returnTo = normalizeReturnTo(searchParams?.returnTo);
  const matchedRole = matchDemoRole(returnTo);

  if (matchedRole) {
    redirect(`/api/auth/demo?email=${encodeURIComponent(matchedRole.email)}&to=${encodeURIComponent(returnTo)}`);
  }

  if (returnTo === '/canon/roles') {
    redirect('/');
  }

  return (
    <main style={{ minHeight: '100vh', background: '#050914', color: '#f8fafc', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Прозрачная Цена</div>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.05, fontWeight: 800 }}>Вход</h1>
        <p style={{ margin: '14px 0 24px', color: '#94a3b8', fontSize: 16, lineHeight: 1.5 }}>
          Демо-вход перенаправляет в нужную роль автоматически. Если автоматический переход не сработал, выбери роль ниже.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          {DEMO_ROLES.map((role) => (
            <a
              key={role.email}
              href={`/api/auth/demo?email=${encodeURIComponent(role.email)}&to=${encodeURIComponent(role.to)}`}
              style={{ textDecoration: 'none', color: 'inherit', background: '#0b1220', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 16 }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{role.label}</div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#8aa0b8' }}>{role.to}</div>
            </a>
          ))}
        </div>
        <div style={{ marginTop: 20 }}>
          <Link href="/" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>← Вернуться к выбору роли</Link>
        </div>
      </div>
    </main>
  );
}
