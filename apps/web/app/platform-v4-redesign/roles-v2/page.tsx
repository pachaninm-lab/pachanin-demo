import Link from 'next/link';

const cards = [
  { href: '/platform-v4-redesign/deal', label: 'Центр сделки', text: 'Статус, блокер, следующий шаг и деньги под риском.' },
  { href: '/platform-v4-redesign/bank', label: 'Банк', text: 'Reserve, hold, release, callbacks и mismatch.' },
  { href: '/platform-v4-redesign/documents', label: 'Документы', text: 'Комплектность пакета и влияние на выпуск денег.' },
  { href: '/platform-v4-redesign/control', label: 'Контроль', text: 'SLA, owner, evidence pack и спор.' },
  { href: '/platform-v4-redesign/seller', label: 'Продавец', text: 'Лоты, рейсы, ожидаемые деньги и коммерческий контур.' },
  { href: '/platform-v4-redesign/buyer', label: 'Покупатель', text: 'Закупка, приемка, качество, документы и выпуск.' },
  { href: '/platform-v4-redesign/driver', label: 'Водитель', text: 'Один рейс, один шаг, одно подтверждение на mobile.' },
  { href: '/platform-v4-redesign/receiving', label: 'Приемка', text: 'Вес, качество, расхождение и подтверждение факта.' },
] as const;

export default function Page() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#f6f8fb 0%,#ffffff 46%,#f3f6fa 100%)', color: '#0f172a' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 16px 56px', display: 'grid', gap: 20 }}>
        <Link href='/platform-v4-redesign' style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, width: 'fit-content', padding: '0 16px', borderRadius: 999, border: '1px solid #dbe3ee', background: '#fff', color: '#2563eb', fontWeight: 800, textDecoration: 'none' }}>
          ← Назад к главной
        </Link>

        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 28, padding: 32, boxShadow: '0 10px 30px rgba(15,23,42,.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#2563eb' }}>Role directory v2</div>
          <h1 style={{ margin: '14px 0 0', fontSize: 'clamp(2.4rem,5vw,4.3rem)', lineHeight: 1.02, letterSpacing: '-.03em', maxWidth: '10ch' }}>
            Каждая роль ведет в рабочее место, а не в одинаковую зеленую карточку.
          </h1>
          <p style={{ margin: '18px 0 0', maxWidth: 820, fontSize: 18, lineHeight: 1.65, color: '#475569' }}>
            Это новый белый экран с другой иерархией. Сначала виден каталог рабочих мест, потом уже переход в нужный контур сделки.
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {cards.map((item) => (
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
                minHeight: 220,
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
                Открыть экран
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
