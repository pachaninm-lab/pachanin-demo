import Link from 'next/link';

const shortlist = [
  { id: 'LOT-001', crop: 'Пшеница', vol: '260 т', price: '15 200 ₽/т', basis: 'CPT Тамбов', quality: 'Протеин 11.4%', status: 'Оффер открыт', tone: 'success' },
  { id: 'LOT-002', crop: 'Кукуруза', vol: '420 т', price: '13 100 ₽/т', basis: 'EXW элеватор', quality: 'Влажность 14%', status: 'Ожидает', tone: 'warn' },
  { id: 'LOT-004', crop: 'Пшеница', vol: '180 т', price: '15 050 ₽/т', basis: 'CPT Воронеж', quality: 'Протеин 11.1%', status: 'Запрос цены', tone: 'indigo' },
] as const;

const compare = [
  { label: 'Landed price', value: '15 900 ₽/т' },
  { label: 'vs рыночный индекс', value: '+1.4%' },
  { label: 'Качество по базису', value: 'Соответствует' },
  { label: 'Оплата', value: 'Ждёт банк' },
  { label: 'Срок поставки', value: '5-7 дней' },
] as const;

const deals = [
  { id: 'DL-9102', crop: 'Кукуруза 420 т', phase: 'Документы в сборке', sum: '6 384 000 ₽', tone: 'warn' },
  { id: 'DL-9088', crop: 'Пшеница 400 т', phase: 'Ожидает загрузки', sum: '6 080 000 ₽', tone: 'indigo' },
] as const;

export default function BuyerPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero'>
          <span className='t7-chip t7-chip-buyer'>ПОКУПАТЕЛЬ</span>
          <h1 className='t7-h1'>Shortlist, цена и контроль сделки</h1>
          <p className='t7-lead'>
            Не бесконечная витрина, а shortlist с ценой, качеством и статусом оплаты.
            Сравнение landed price, соответствие базису и готовность банка — на одном экране.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/catalog' className='t7-btn primary'>Открыть каталог</Link>
            <Link href='/platform-v7/deal' className='t7-btn'>Сделка DL-9102</Link>
            <Link href='/platform-v7/bank' className='t7-btn ghost'>Статус оплаты</Link>
          </div>
        </section>

        {/* METRICS */}
        <div className='t7-grid3'>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-buyer'>Shortlist</span>
            <div className='t7-value' style={{ color: 'var(--buyer)' }}>12</div>
            <div className='t7-label'>Лотов в shortlist</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip'>Средняя цена</span>
            <div className='t7-value'>15 200 ₽</div>
            <div className='t7-label'>Пшеница / тонна</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-indigo'>Бюджет</span>
            <div className='t7-value'>24,0 млн ₽</div>
            <div className='t7-label'>В работе по активным сделкам</div>
          </article>
        </div>

        {/* SHORTLIST + COMPARE */}
        <div className='t7-grid2'>
          <section className='t7-panel'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className='t7-eyebrow'>Shortlist</div>
              <Link href='/platform-v7/catalog' className='t7-cta' style={{ fontSize: 12 }}>Каталог →</Link>
            </div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {shortlist.map(({ id, crop, vol, price, basis, quality, status, tone }) => (
                <div key={id} className='t7-row'>
                  <div>
                    <div className='t7-rowtitle'>{id} · {crop} · {vol}</div>
                    <div className='t7-rowtext'>{basis} · {quality}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className='t7-value-sm'>{price}</div>
                    <span className={`t7-chip t7-chip-${tone}`} style={{ marginTop: 4, fontSize: 10 }}>{status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='t7-panel'>
            <div className='t7-eyebrow'>Ценовой анализ</div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {compare.map(({ label, value }) => (
                <div key={label} className='t7-row' style={{ gridTemplateColumns: '1fr auto' }}>
                  <div className='t7-rowtext'>{label}</div>
                  <div className='t7-rowtitle' style={{ fontSize: 14, textAlign: 'right' }}>{value}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ACTIVE DEALS */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>Активные сделки</div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {deals.map(({ id, crop, phase, sum, tone }) => (
              <div key={id} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{id} · {crop}</div>
                  <div className='t7-rowtext'>{phase}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className='t7-value-sm'>{sum}</div>
                  <span className={`t7-chip t7-chip-${tone}`} style={{ marginTop: 4, fontSize: 10 }}>{phase}</span>
                </div>
              </div>
            ))}
          </div>
          <Link href='/platform-v7/deal' className='t7-btn primary' style={{ marginTop: 16 }}>
            Открыть cockpit сделки
          </Link>
        </section>

      </div>
    </div>
  );
}
