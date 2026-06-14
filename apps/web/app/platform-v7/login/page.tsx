import { CockpitHero, PremiumCtaButton, StatusPill } from '@/components/platform-v7/premium';

const methods = [
  {
    title: 'Вход через ЕСИА',
    note: 'Для компаний и пользователей с подтверждённой государственной учётной записью и ролью.',
    tone: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.18)',
    color: '#2563EB',
  },
  {
    title: 'Вход через СберБизнес ID',
    note: 'Для банковского контура: безопасная сделка, эскроу и факторинг. Внешнее подтверждение ожидает подключения.',
    tone: 'rgba(10,122,95,0.08)',
    border: 'rgba(10,122,95,0.18)',
    color: '#0A7A5F',
  },
  {
    title: 'Email и пароль',
    note: 'Рабочий вход по логину и паролю для участников предынтеграционного контура.',
    tone: 'rgba(180,83,9,0.08)',
    border: 'rgba(180,83,9,0.18)',
    color: '#B45309',
  },
];

const field: React.CSSProperties = {
  minHeight: 46,
  borderRadius: 12,
  border: '1px solid var(--pc-prem-border, rgba(15,23,42,0.09))',
  background: 'var(--pc-prem-surface, #fff)',
  padding: '0 14px',
  fontSize: 14,
  color: 'var(--pc-prem-text, #0F1419)',
  width: '100%',
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--pc-prem-text-muted, #64748B)' };
const card: React.CSSProperties = {
  background: 'var(--pc-prem-surface, #fff)',
  border: '1px solid var(--pc-prem-border, rgba(15,23,42,0.09))',
  borderRadius: 18,
  padding: 18,
  display: 'grid',
  gap: 12,
};

export default function LoginPage() {
  return (
    <main style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto', padding: '8px 0 28px' }}>
      <CockpitHero
        eyebrow='Вход в платформу'
        title='Войдите в свой'
        accent='рабочий контур'
        lead='После входа: роль → организация → личный кабинет → разрешённые действия. Способ входа зависит от контура: ЕСИА — подтверждённая роль, СберБизнес ID — банковский слой, email — участник контура.'
        aside={<StatusPill tone='success'>Защищённый вход</StatusPill>}
      />

      <section aria-label='Способы входа' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {methods.map((method) => (
          <div key={method.title} style={{ ...card, border: `1px solid ${method.border}` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: method.tone, color: method.color, fontSize: 12, fontWeight: 800, width: 'fit-content' }}>
              {method.title}
            </span>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--pc-prem-text-muted, #64748B)', lineHeight: 1.55 }}>{method.note}</p>
            <div style={{ marginTop: 'auto' }}>
              <PremiumCtaButton href='/platform-v7/auth' variant='ghost'>Продолжить</PremiumCtaButton>
            </div>
          </div>
        ))}
      </section>

      <form aria-label='Вход по email и паролю' style={card}>
        <span style={label}>Email</span>
        <input style={field} type='email' name='email' placeholder='name@company.ru' autoComplete='email' />
        <span style={label}>Пароль</span>
        <input style={field} type='password' name='password' placeholder='••••••••' autoComplete='current-password' />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 4 }}>
          <PremiumCtaButton href='/platform-v7' glyph='shield-check'>Войти в кабинет</PremiumCtaButton>
          <PremiumCtaButton href='/platform-v7/register' variant='ghost'>Регистрация компании</PremiumCtaButton>
        </div>
      </form>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--pc-prem-text-muted, #64748B)', lineHeight: 1.5 }}>
        Внешние подтверждения (ЕСИА, банк) ожидают подключения. Вход в кабинет открывает роли только разрешённые действия.
      </p>
    </main>
  );
}
