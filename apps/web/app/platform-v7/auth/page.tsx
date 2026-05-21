import Link from 'next/link';

const flows = [
  {
    title: 'ЕСИА',
    description: 'Подтверждённая роль и государственный контур для идентификации пользователя и компании.',
    actions: ['Вход', 'Привязка компании', 'Повторная авторизация'],
    tone: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.18)',
    color: '#2563EB',
  },
  {
    title: 'СберБизнес ID',
    description: 'Финансовый контур: безопасная сделка, эскроу, факторинг, банковые callback-события.',
    actions: ['Вход', 'Связать банк', 'Обновить доступ'],
    tone: 'rgba(10,122,95,0.08)',
    border: 'rgba(10,122,95,0.18)',
    color: '#0A7A5F',
  },
  {
    title: 'Email / пароль',
    description: 'Внутренний и демо-сценарий для операторов, тестовых пользователей и pilot-ready среды.',
    actions: ['Вход', 'Сброс пароля', 'Создать доступ'],
    tone: 'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.18)',
    color: '#B45309',
  },
];

export default function AuthPage() {
  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 1080 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800, width: 'fit-content' }}>
            Auth hub
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.08, fontWeight: 800, color: '#0F1419' }}>Способы входа и связки</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, maxWidth: 820 }}>
            Единая точка выбора между ЕСИА, СберБизнес ID и email-контуром. Нужна, чтобы разделить подтверждённую идентификацию, банковую авторизацию и внутренний доступ.
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {flows.map((flow) => (
          <div key={flow.title} style={{ background: '#fff', border: `1px solid ${flow.border}`, borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: flow.tone, color: flow.color, fontSize: 12, fontWeight: 800, width: 'fit-content' }}>{flow.title}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{flow.description}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {flow.actions.map((action) => (
                <span key={action} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 700 }}>{action}</span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Быстрый переход</div>
          <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>Открывай нужный контур без лишнего поиска по платформе.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/login" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>Вход</Link>
          <Link href="/platform-v7/register" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA', fontSize: 13, fontWeight: 800 }}>Регистрация</Link>
        </div>
      </section>
    </div>
  );
}
