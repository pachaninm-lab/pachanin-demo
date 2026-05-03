import Link from 'next/link';

const PRIMARY_ROLES = [
  {
    title: 'Продавец',
    text: 'Лот, предложения, документы, отгрузка, получение денег.',
    href: '/platform-v7/seller',
    accent: '#0A7A5F',
  },
  {
    title: 'Покупатель',
    text: 'Выбор лота, ставка, резерв денег, приёмка, документы.',
    href: '/platform-v7/buyer',
    accent: '#2563EB',
  },
  {
    title: 'Логистика',
    text: 'Заявка, водитель, рейс, маршрут, пломба, фото, вес.',
    href: '/platform-v7/logistics',
    accent: '#7C3AED',
  },
  {
    title: 'Водитель',
    text: 'Один рейс, маршрут и события без доступа к деньгам.',
    href: '/platform-v7/driver',
    accent: '#475569',
  },
  {
    title: 'Приёмка',
    text: 'Элеватор, вес, качество, акт и основание для выплаты.',
    href: '/platform-v7/elevator',
    accent: '#B45309',
  },
  {
    title: 'Банк',
    text: 'Резерв, удержание, выпуск денег и причины остановки.',
    href: '/platform-v7/bank',
    accent: '#0F172A',
  },
] as const;

const CONTROL_ROLES = [
  { title: 'Центр управления', href: '/platform-v7/control-tower' },
  { title: 'Лаборатория', href: '/platform-v7/lab' },
  { title: 'Сюрвейер', href: '/platform-v7/surveyor' },
  { title: 'Арбитр', href: '/platform-v7/arbitrator' },
  { title: 'Комплаенс', href: '/platform-v7/compliance' },
  { title: 'Руководитель', href: '/platform-v7/executive' },
] as const;

export default function PlatformV7RolesPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 20, display: 'grid', gap: 10 }}>
        <div style={{ width: 42, height: 4, borderRadius: 999, background: '#0A7A5F' }} />
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(32px, 8vw, 50px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>
          Выберите роль
        </h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 }}>
          Каждый кабинет показывает только свой участок сделки: действие, документы, деньги, груз и причины остановки.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {PRIMARY_ROLES.map((role) => (
          <Link key={role.href} href={role.href} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 12, boxShadow: '0 12px 28px rgba(15,20,25,0.045)' }}>
            <div style={{ width: 42, height: 4, borderRadius: 999, background: role.accent }} />
            <div style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ margin: 0, color: '#0F1419', fontSize: 28, lineHeight: 1.08, fontWeight: 950 }}>{role.title}</h2>
              <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.5 }}>{role.text}</p>
            </div>
            <div style={{ marginTop: 'auto', minHeight: 44, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', background: role.accent, color: '#fff', fontSize: 15, fontWeight: 900, textAlign: 'center' }}>
              Открыть
            </div>
          </Link>
        ))}
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Дополнительные контуры
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CONTROL_ROLES.map((role) => (
            <Link key={role.href} href={role.href} style={{ textDecoration: 'none', minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '9px 13px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 850 }}>
              {role.title}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
