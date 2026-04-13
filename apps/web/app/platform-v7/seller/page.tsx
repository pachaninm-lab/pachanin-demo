import Link from 'next/link';

const lots = [
  { id: 'LOT-001', crop: 'Кукуруза', vol: '420 т', basis: 'CPT Тамбов', price: '15 200 ₽/т', status: 'Блокер документа', tone: 'danger' },
  { id: 'LOT-002', crop: 'Пшеница', vol: '260 т', basis: 'EXW элеватор', price: '14 800 ₽/т', status: 'Нужен shortlist', tone: 'warn' },
  { id: 'LOT-003', crop: 'Подсолнечник', vol: '180 т', basis: 'FOB склад', price: '36 200 ₽/т', status: 'Ручная проверка', tone: 'warn' },
] as const;

const actions = [
  { text: 'Подписать акт приёмки — LOT-001', sub: 'Блокирует 3,2 млн ₽', tone: 'danger' },
  { text: 'Загрузить форму ЗТТ — LOT-002', sub: 'Требуется для подтверждения сделки', tone: 'warn' },
  { text: 'Проверить запрос покупателя — LOT-003', sub: 'Несоответствие качества', tone: 'warn' },
] as const;

const history = [
  { id: 'DL-8841', crop: 'Кукуруза 500 т', sum: '7 600 000 ₽', date: '12.03.2026', status: 'Завершена' },
  { id: 'DL-8822', crop: 'Пшеница 300 т', sum: '4 440 000 ₽', date: '28.02.2026', status: 'Завершена' },
  { id: 'DL-8790', crop: 'Соя 120 т', sum: '4 344 000 ₽', date: '14.02.2026', status: 'Завершена' },
] as const;

export default function SellerPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero'>
          <span className='t7-chip t7-chip-seller'>ПРОИЗВОДИТЕЛЬ</span>
          <h1 className='t7-h1'>Деньги, лоты и блокеры — с первого экрана</h1>
          <p className='t7-lead'>
            Кабинет продавца начинается с денег и немедленных действий.
            Коммерция — ниже, управление выплатами — выше.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/deal' className='t7-btn primary'>Открыть сделку DL-9102</Link>
            <Link href='/platform-v7/documents' className='t7-btn'>Загрузить документ</Link>
            <Link href='/platform-v7/catalog' className='t7-btn ghost'>Создать лот</Link>
          </div>
        </section>

        {/* MONEY METRICS */}
        <div className='t7-grid3'>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-success'>Ожидается</span>
            <div className='t7-value' style={{ color: 'var(--seller)' }}>18 400 000 ₽</div>
            <div className='t7-label'>Итого по активным сделкам</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-danger'>Зависло</span>
            <div className='t7-value' style={{ color: 'var(--danger)' }}>3 200 000 ₽</div>
            <div className='t7-label'>Из-за незагруженных документов</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-warn'>Блокеры</span>
            <div className='t7-value'>1</div>
            <div className='t7-label'>Документ блокирует выпуск</div>
          </article>
        </div>

        {/* PRIORITY ACTIONS */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>Приоритетные действия</div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {actions.map(({ text, sub, tone }) => (
              <div key={text} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{text}</div>
                  <div className='t7-rowtext'>{sub}</div>
                </div>
                <span className={`t7-chip t7-chip-${tone}`}>
                  {tone === 'danger' ? 'Срочно' : 'Действие'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* LOTS */}
        <section className='t7-panel'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className='t7-eyebrow'>Активные лоты</div>
            <Link href='/platform-v7/catalog' className='t7-cta' style={{ fontSize: 12 }}>Все лоты →</Link>
          </div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {lots.map(({ id, crop, vol, basis, price, status, tone }) => (
              <div key={id} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{id} · {crop} · {vol}</div>
                  <div className='t7-rowtext'>{basis} · {price}</div>
                </div>
                <span className={`t7-chip t7-chip-${tone}`}>{status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* HISTORY */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>История сделок</div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {history.map(({ id, crop, sum, date, status }) => (
              <div key={id} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{id} · {crop}</div>
                  <div className='t7-rowtext'>{date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className='t7-value-sm'>{sum}</div>
                  <span className='t7-chip t7-chip-success' style={{ marginTop: 4, fontSize: 10 }}>{status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
