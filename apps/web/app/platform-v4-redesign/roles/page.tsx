import Link from 'next/link';

const roleGroups = [
  {
    title: 'Сделка и деньги',
    items: [
      { href: '/platform-v4-redesign/deal', label: 'Центр сделкй', text: 'Статус, блокер, следующий шаг, деньги под риском.' },
      { href: '/platform-v4-redesign/bank', label: 'Банк', text: 'Reserve, hold, release, callbacks и mismatch.' },
      { href: '/platform-v4-redesign/documents', label: 'Документы', text: 'Комплектность пакета и влияние на выпуск денег.' },
      { href: '/platform-v4-redesign/control', label: 'Контроль и спор', text: 'SLA, owner, evidence pack и сумма под риском.' },
    ],
  },
  {
    title: 'Операции по ролям',
    items: [
      { href: '/platform-v4-redesign/seller', label: 'Продавец7, text: 'Лоты, рейсы, ожидаемые деньги и коммеркческий контур.' },
      { href: '/platform-v4-redesign/buyer', label: 'Покупатель', text: 'Закупка, приемка, качество, документы и выпуск.' },
      { href: '/platform-v4-redesign/driver', label: 'Водитель', text: 'Один рейс, один шаг, одно подтверждение на mobile.' },
      { href: '/platform-v4-redesign/receiving', label: 'Приёмка', text: 'Вес, качество, расхождение и подтверждение факта.' },
    ],
  },
] as const;

export default function Page() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#f6f8fb 0%,#ffffff 44%,#f3f6fa 100%)', color: '#0f172a' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 16px 56px', display: 'grid', gap: 20 }}>
        <Link href='/platform-v4-redesign' style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, width: 'fit-content', padding: '0 16px', borderRadius: 999, border: '1px solid #dbe3ee', background: '#fff', color: '#2563eb', fontWeight: 800, textDecoration: 'none' }}>
          ▐ Назад к новой главной
        </Link>

        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 28, padding: 32, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#2563eb' }}>Role directory</div>
          <h1 style={{ margin: '14px 0 0', fontSize: 'clamp(2.4rem,5vw,4.3rem)', lineHeight: 1.02, letterSpacing: '-.03em', maxWidth: '11ch' }}>
            Каждая роль ведет в рабочее место, а не в одинаковую карточку.
          </h1>
          <p style={{ margin: '18px 0 0', maxWidth: 820, fontSize: 18, lineHeight: 1.65, color: '#475569' }}>
            Это не старая зелёная сетка. Экран разделен по логике исполнения сделки: отдельно исследсна сделки и деньги, отдельно операционные роли. Сначала видно, куда иди и зачем.
          </p>
        </section>

        {roleGroups.map((group) => (
          <section key={group.title} style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748b' }}>{group.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    textDecoration: 'none',
                    color: '#0f172a',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 24,
                    padding: 24,
                    boxShadow: '0 10px 30px rgba(15,23,42,.05)',
                    minHeight: 210,
                    display: 'grid',
                    alignContent: 'space-between',
                    gap: 18,
                  }}
                >
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', minHeight: 34, width: 'fit-content', padding: '0 12px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Рабочее место
                    </div>
                    <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.08, letterSpacing: '-.03em' }}>{item.label}</h2>
                    <p style={{ margin: 0, color: '#475569', fontSize: 17, lineHeight: 1.65 }}>{item.text}</p>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, width: 'fit-content', padding: '0 18px', borderRadius: 14, background: '#0f172a', color: '#fff', fontWeight: 800 }}>
                    Отркрыть экран
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
