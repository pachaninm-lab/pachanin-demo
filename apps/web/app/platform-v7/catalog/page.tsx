import Link from 'next/link';

const prices = [
  { crop: 'Пшеница', price: '15 200 ₽/т', delta: '+2.4%', basis: 'CPT Тамбов', up: true },
  { crop: 'Кукуруза', price: '13 100 ₽/т', delta: '−1.1%', basis: 'EXW элеватор', up: false },
  { crop: 'Соя', price: '36 200 ₽/т', delta: '+1.8%', basis: 'FOB склад', up: true },
  { crop: 'Подсолнечник', price: '28 400 ₽/т', delta: '+0.7%', basis: 'EXW', up: true },
] as const;

const lots = [
  { id: 'LOT-001', crop: 'Пшеница', vol: '260 т', price: '14 800 ₽/т', basis: 'CPT Тамбов', seller: 'КФХ Ковалёв', status: 'Открыт', tone: 'success' },
  { id: 'LOT-002', crop: 'Кукуруза', vol: '420 т', price: '15 200 ₽/т', basis: 'EXW элеватор', seller: 'ООО Зернотрейд', status: 'Открыт', tone: 'success' },
  { id: 'LOT-003', crop: 'Соя', vol: '180 т', price: '36 200 ₽/т', basis: 'FOB склад', seller: 'КФХ Иванов', status: 'Открыт', tone: 'success' },
  { id: 'LOT-004', crop: 'Подсолнечник', vol: '320 т', price: '28 400 ₽/т', basis: 'EXW', seller: 'КФХ Петров', status: 'Предзапись', tone: 'warn' },
  { id: 'LOT-005', crop: 'Пшеница', vol: '100 т', price: '15 050 ₽/т', basis: 'CPT Воронеж', seller: 'ООО Агросбыт', status: 'Открыт', tone: 'success' },
  { id: 'LOT-006', crop: 'Ячмень', vol: '240 т', price: '11 400 ₽/т', basis: 'CPT Саратов', seller: 'КФХ Орлов', status: 'Ожидает', tone: 'indigo' },
] as const;

export default function CatalogPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero'>
          <div className='t7-eyebrow'>Рынок зерна</div>
          <h1 className='t7-h1'>Каталог лотов и рыночные цены</h1>
          <p className='t7-lead'>
            Активные предложения, текущие цены и динамика по ключевым культурам.
            Прямой путь от цены к оформлению сделки.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/buyer' className='t7-btn primary'>Добавить в shortlist</Link>
            <Link href='/platform-v7/seller' className='t7-btn'>Разместить лот</Link>
          </div>
        </section>

        {/* MARKET STATS */}
        <div className='t7-grid3'>
          <article className='t7-card'>
            <span className='t7-chip'>Заявки</span>
            <div className='t7-value'>128</div>
            <div className='t7-label'>Активных предложений сейчас</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-indigo'>Объём</span>
            <div className='t7-value'>24 500 т</div>
            <div className='t7-label'>В активных торгах</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-success'>Оборот</span>
            <div className='t7-value'>312 млн ₽</div>
            <div className='t7-label'>За последние 30 дней</div>
          </article>
        </div>

        {/* PRICE TICKER */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>Цены сейчас</div>
          <div className='t7-grid4' style={{ marginTop: 16 }}>
            {prices.map(({ crop, price, delta, basis, up }) => (
              <article key={crop} className='t7-card' style={{ borderTop: `3px solid ${up ? 'var(--success)' : 'var(--danger)'}` }}>
                <div className='t7-h3'>{crop}</div>
                <div className='t7-value' style={{ fontSize: 22, marginTop: 10 }}>{price}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span className={`t7-chip ${up ? 't7-chip-success' : 't7-chip-danger'}`}>{delta}</span>
                  <span className='t7-small'>{basis}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* LOT LIST */}
        <section className='t7-panel'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div className='t7-eyebrow'>Активные лоты</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className='t7-chip t7-chip-success'>{lots.filter(l => l.status === 'Открыт').length} открытых</span>
              <span className='t7-chip t7-chip-warn'>{lots.filter(l => l.status === 'Предзапись').length} предзапись</span>
            </div>
          </div>
          <div className='t7-list' style={{ marginTop: 16 }}>
            {lots.map(({ id, crop, vol, price, basis, seller, status, tone }) => (
              <div key={id} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{id} · {crop} · {vol}</div>
                  <div className='t7-rowtext'>{basis} · {seller}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className='t7-value-sm'>{price}</div>
                  <span className={`t7-chip t7-chip-${tone}`} style={{ marginTop: 4, fontSize: 10 }}>{status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TRUST */}
        <section className='t7-panel' style={{ background: 'linear-gradient(135deg,rgba(5,150,105,.04),rgba(79,70,229,.03))' }}>
          <div className='t7-eyebrow'>Гарантии платформы</div>
          <div className='t7-grid4' style={{ marginTop: 14 }}>
            {['ФГИС «Зерно»', 'НСЗ', 'Банк-партнёр', 'Безопасный release'].map((x) => (
              <div key={x} className='t7-card' style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>
                {x}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
