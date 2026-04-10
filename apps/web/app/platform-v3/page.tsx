import Link from 'next/link';

const prices = [
  { culture: 'Пшеница 3 класса', local: '14 500 ₽/т', ntb: '15 200 ₽/т', delta: '+4,8%' },
  { culture: 'Подсолнечник', local: '28 000 ₽/т', ntb: '29 800 ₽/т', delta: '+6,4%' },
  { culture: 'Кукуруза', local: '12 800 ₽/т', ntb: '13 100 ₽/т', delta: '+2,3%' },
  { culture: 'Соя', local: '35 000 ₽/т', ntb: '36 200 ₽/т', delta: '+3,4%' },
];

const actions = [
  { title: 'Кабинет продавца', href: '/platform-v3/seller' },
  { title: 'Создать лот', href: '/platform-v3/seller/new-lot' },
  { title: 'Центр сделки', href: '/platform-v3/deal' },
  { title: 'Документы', href: '/platform-v3/documents' },
  { title: 'Логистика', href: '/platform-v3/logistics' },
  { title: 'Лаборатория', href: '/platform-v3/lab' },
];

const news = [
  { title: 'Пшеница 3 класса выросла на 2,3% за неделю', source: 'НТБ · сегодня, 08:00' },
  { title: 'По югу усиливается спрос на кукурузу с поставкой на элеватор', source: 'Рынок · сегодня, 09:30' },
  { title: 'Экспортная пошлина на подсолнечник снижена', source: 'Минсельхоз · вчера, 14:00' },
];

function shell(): React.CSSProperties {
  return {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #050914 0%, #071120 100%)',
    color: '#f8fafc',
    fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif',
  };
}

function card(): React.CSSProperties {
  return {
    background: 'linear-gradient(180deg, rgba(13,18,31,.98) 0%, rgba(10,15,27,.98) 100%)',
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 24,
    boxShadow: '0 12px 40px rgba(0,0,0,.22)',
  };
}

export default function Page() {
  return (
    <main style={shell()}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)', background: 'rgba(8,12,22,.88)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px' }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,.28)' }} />
            <div style={{ flex: 1, color: '#22c55e', fontWeight: 900, fontSize: 22 }}>Прозрачная Цена</div>
            <div style={{ padding: '10px 14px', borderRadius: 999, border: '1px solid rgba(34,197,94,.28)', color: '#22c55e', fontWeight: 800, fontSize: 14 }}>Рынок и исполнение сделки</div>
            <div style={{ width: 42, height: 42, borderRadius: 21, background: 'rgba(34,197,94,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 900 }}>ПЦ</div>
          </div>
        </header>

        <div style={{ padding: '20px 16px 48px' }}>
          <section style={{ display: 'grid', gap: 16 }}>
            <div style={{ ...card(), padding: 20 }}>
              <div style={{ color: '#22c55e', fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: '.08em' }}>Главная рынка</div>
              <h1 style={{ margin: '10px 0 0', fontSize: 'clamp(34px, 6vw, 58px)', lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.03em', maxWidth: 920 }}>Живая платформа сделки, а не витрина объявлений</h1>
              <p style={{ margin: '14px 0 0', color: '#94a3b8', fontSize: 18, lineHeight: 1.6, maxWidth: 980 }}>Здесь цена, допуск, офферы, логистика, приёмка, лаборатория, документы, деньги и спор собраны в одном контуре сделки.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <Link href="/platform-v3/roles" style={{ textDecoration: 'none', background: '#22c55e', color: '#04110a', padding: '15px 18px', borderRadius: 16, fontWeight: 900, fontSize: 17 }}>Открыть роли</Link>
                <Link href="/platform-v3/seller" style={{ textDecoration: 'none', background: 'rgba(255,255,255,.03)', color: '#f8fafc', padding: '15px 18px', borderRadius: 16, border: '1px solid rgba(255,255,255,.08)', fontWeight: 800, fontSize: 17 }}>Открыть кабинет продавца</Link>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
              <div style={{ ...card(), padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.06 }}>Рынок и офферы</div>
                  <div style={{ background: 'rgba(34,197,94,.12)', color: '#22c55e', borderRadius: 14, padding: '10px 12px', fontWeight: 800, fontSize: 14 }}>НТБ-мост</div>
                </div>
                <div style={{ color: '#8ea0b7', fontSize: 16, lineHeight: 1.5 }}>Сравнение локальной цены и биржевого контура с переходом в сделку.</div>
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  {prices.map((item) => (
                    <div key={item.culture} style={{ padding: '14px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>{item.culture}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginTop: 10, alignItems: 'center' }}>
                        <div style={{ color: '#cbd5e1', fontSize: 18 }}>{item.local}</div>
                        <div style={{ color: '#fbbf24', fontSize: 18, fontWeight: 800 }}>{item.ntb}</div>
                        <div style={{ background: 'rgba(34,197,94,.12)', color: '#22c55e', borderRadius: 999, padding: '8px 12px', fontSize: 15, fontWeight: 800 }}>{item.delta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...card(), padding: 20 }}>
                <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.06, marginBottom: 8 }}>Быстрые действия</div>
                <div style={{ color: '#8ea0b7', fontSize: 16, lineHeight: 1.5 }}>Рабочие входы в основные модули платформы.</div>
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                  {actions.map((item) => (
                    <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: '#f8fafc', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 18, padding: '16px 14px', fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{item.title}</Link>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ ...card(), padding: 20 }}>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.06 }}>Новости рынка</div>
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {news.map((item) => (
                  <div key={item.title} style={{ padding: '14px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{item.title}</div>
                    <div style={{ marginTop: 8, color: '#8ea0b7', fontSize: 16 }}>{item.source}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
