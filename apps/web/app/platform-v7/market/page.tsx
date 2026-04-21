import Link from 'next/link';

const PRICES = [
  { crop: 'Пшеница 3 кл.', region: 'Тамбовская область', basis: 'EXW', price: '14 500 ₽/т', delta: '+2.1%', note: 'Спрос со стороны переработки и стабильный документный контур.' },
  { crop: 'Пшеница 4 кл.', region: 'Воронежская область', basis: 'CPT', price: '13 900 ₽/т', delta: '+1.4%', note: 'Поддержка за счёт логистики и плотного контракта.' },
  { crop: 'Подсолнечник', region: 'Ростовская область', basis: 'EXW', price: '28 800 ₽/т', delta: '-0.8%', note: 'Коррекция после предыдущего роста.' },
  { crop: 'Ячмень', region: 'Ставропольский край', basis: 'DAP', price: '12 700 ₽/т', delta: '+0.6%', note: 'Стабильная региональная торговля.' },
];

const TRENDS = [
  { title: '30 дней', note: 'Короткий горизонт для переговоров и быстрых решений.', values: ['13.9', '14.1', '14.2', '14.4', '14.5'] },
  { title: '90 дней', note: 'Средний тренд для оценки базиса и timing сделки.', values: ['13.2', '13.5', '13.8', '14.1', '14.5'] },
  { title: '365 дней', note: 'Широкий контекст для переговоров и стратегии закупки.', values: ['11.8', '12.4', '13.1', '13.9', '14.5'] },
];

const MARKET_MODULES = [
  {
    title: 'Лоты',
    note: 'Рынок превращается в действие через выставление и сравнение лотов.',
    href: '/platform-v7/lots',
  },
  {
    title: 'Сделки',
    note: 'Ценовой слой должен вести в переговоры, сделку и дальнейшее исполнение.',
    href: '/platform-v7/deals',
  },
  {
    title: 'Профиль и доверие',
    note: 'Цена без доверия к контрагенту слабая. Профиль и карточки компаний уже внутри платформы.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Онбординг компании',
    note: 'Новый участник рынка может зайти в платформу через onboarding и сразу перейти к работе с лотами.',
    href: '/platform-v7/onboarding',
  },
];

function deltaTone(delta: string) {
  return delta.startsWith('-')
    ? { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' }
    : { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' };
}

export default function MarketPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1080, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Витрина рынка</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Рабочий ценовой слой для переговоров и принятия решений. Не просто график ради графика, а контекст: культура, регион, базис, направление и динамика.
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Связанные модули платформы</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Ценовой экран уже связан с рабочим контуром сделки, лотов, доверия к контрагенту и входом новых компаний в платформу.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MARKET_MODULES.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Индикативные цены</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {PRICES.map((row) => {
            const tone = deltaTone(row.delta);
            return (
              <article key={`${row.crop}-${row.region}`} style={{ border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, background: '#F8FAFB', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{row.crop}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{row.region} · {row.basis}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0F1419' }}>{row.price}</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800, marginTop: 6 }}>
                      {row.delta}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{row.note}</div>
              </article>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {TRENDS.map((trend) => (
          <section key={trend.title} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{trend.title}</div>
            <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{trend.note}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {trend.values.map((v, i) => (
                <div key={`${trend.title}-${i}`} style={{ flex: 1, display: 'grid', alignItems: 'end', gap: 6 }}>
                  <div style={{ height: `${Number(v) * 6}px`, borderRadius: 10, background: 'linear-gradient(180deg, rgba(10,122,95,0.75), rgba(10,122,95,0.18))', minHeight: 32 }} />
                  <div style={{ fontSize: 11, color: '#6B778C', textAlign: 'center' }}>{v}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Как использовать этот экран</div>
        <Bullet text='Покупатель видит, где рынок уже ушёл вверх и где есть риск переплатить.' />
        <Bullet text='Продавец видит, где лучше выставлять партию по базису и региону.' />
        <Bullet text='Оператор получает контекст переговоров, а не просто цену без истории.' />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/lots' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Открыть лоты
        </Link>
        <Link href='/platform-v7/deals' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Сделки
        </Link>
      </div>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
      <span style={{ fontWeight: 900 }}>•</span>
      <span>{text}</span>
    </div>
  );
}
