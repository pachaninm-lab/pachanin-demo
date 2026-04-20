import Link from 'next/link';

const methods = [
  { title: 'Вход через ЕСИА', note: 'Для компаний и пользователей, которым нужен подтверждённый государственный контур.', tone: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' },
  { title: 'Вход через СберБизнес ID', note: 'Для банкового контура, безопасной сделки, эскроу и факторинга.', tone: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' },
  { title: 'Email + пароль', note: 'Резервный сценарий для демо, внутренних пользователей и тестового контура.', tone: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309' },
];

export default function LoginPage() {
  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 980 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 800, width: 'fit-content' }}>
            Вход в платформу
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.08, fontWeight: 800, color: '#0F1419' }}>Авторизация</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, maxWidth: 760 }}>
            Выбери способ входа в зависимости от контура: ЕСИА для подтверждённой роли, СберБизнес ID для банкового слоя и email для демо или внутреннего доступа.
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {methods.map((method) => (
          <div key={method.title} style={{ background: '#fff', border: `1px solid ${method.border}`, borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: method.tone, color: method.color, fontSize: 12, fontWeight: 800, width: 'fit-content' }}>{method.title}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{method.note}</div>
            <button type="button" style={{ marginTop: 'auto', borderRadius: 12, padding: '10px 14px', background: '#0F1419', color: '#fff', border: '1px solid #0F1419', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Продолжить</button>
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Нет учётной записи?</div>
          <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>Создай компанию, подключи документы и банковый контур.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/platform-v7/register" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>Регистрация</Link>
          <Link href="/platform-v7/auth" style={{ textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: '#fff', color: '#0F1419', border: '1px solid #E4E6EA', fontSize: 13, fontWeight: 800 }}>Все способы входа</Link>
        </div>
      </section>
    </div>
  );
}
