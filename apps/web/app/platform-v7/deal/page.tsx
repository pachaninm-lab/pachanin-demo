import Link from 'next/link';

const steps = [
  { label: 'Цена и допуск', meta: 'Подтверждено', state: 'done' },
  { label: 'Логистика', meta: 'Рейс ДОС-2847', state: 'done' },
  { label: 'Документы', meta: '1 блокер', state: 'blocked' },
  { label: 'Выпуск денег', meta: 'Ждёт документы', state: 'pending' },
] as const;

const timeline = [
  { date: '15.03 14:30', text: 'Банк ввёл hold 624 000 ₽ — спор о качестве зерна', tone: 'danger' },
  { date: '15.03 09:00', text: 'Callback CB-442: mismatch по качеству, требует ручной сверки', tone: 'warn' },
  { date: '14.03 16:00', text: 'Продавец загрузил паспорт качества ФГИС Зерно', tone: 'success' },
  { date: '13.03 11:00', text: 'Лаборатория: протокол ЛАБ-2847 — расхождение протеина 0.8%', tone: 'warn' },
  { date: '10.03 08:45', text: 'Резерв 6 384 000 ₽ подтверждён банком', tone: 'success' },
] as const;

const docs = [
  { name: 'Договор поставки', status: 'Загружен', tone: 'success', date: '06.03' },
  { name: 'Счёт-фактура', status: 'Загружен', tone: 'success', date: '07.03' },
  { name: 'Паспорт качества ФГИС', status: 'Загружен', tone: 'success', date: '14.03' },
  { name: 'Транспортная накладная', status: 'Загружен', tone: 'success', date: '12.03' },
  { name: 'Акт приёмки (форма А)', status: 'Не загружен', tone: 'danger', date: '—' },
  { name: 'Форма ЗТТ', status: 'На подписи', tone: 'warn', date: '—' },
] as const;

export default function DealPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className='t7-chip t7-chip-indigo'>COCKPIT СДЕЛКИ</span>
            <span className='t7-chip t7-chip-warn'>1 блокер</span>
            <span className='t7-chip t7-chip-danger'>Спор активен</span>
          </div>
          <h1 className='t7-h1' style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', maxWidth: 'none', marginTop: 14 }}>
            DL-9102 · Кукуруза 420 т · Тамбов → Черноземный
          </h1>
          <p className='t7-lead'>
            Все стороны, статусы, деньги, документы и события сделки в одном месте.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/bank' className='t7-btn primary'>Денежный контур</Link>
            <Link href='/platform-v7/documents' className='t7-btn'>Документы</Link>
            <Link href='/platform-v7/control' className='t7-btn danger'>Споры</Link>
          </div>
        </section>

        {/* PIPELINE */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>Статус исполнения</div>
          <div className='t7-steps' style={{ marginTop: 16 }}>
            {steps.map((s) => (
              <div key={s.label} className={`t7-step ${s.state}`}>
                <div className='t7-line' />
                <div className='t7-steptitle'>{s.label}</div>
                <div className='t7-stepmeta'>{s.meta}</div>
              </div>
            ))}
          </div>
        </section>

        {/* METRICS */}
        <div className='t7-grid4'>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-indigo'>Сумма</span>
            <div className='t7-value'>6 384 000 ₽</div>
            <div className='t7-label'>Общая стоимость сделки</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-docs'>Документы</span>
            <div className='t7-value'>92%</div>
            <div className='t7-label'>Полнота пакета (11/12)</div>
            <div className='t7-progress' style={{ marginTop: 12 }}><span style={{ width: '92%' }} /></div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-danger'>Hold</span>
            <div className='t7-value' style={{ color: 'var(--danger)' }}>624 000 ₽</div>
            <div className='t7-label'>Под удержанием — спор о качестве</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-warn'>Блокер</span>
            <div className='t7-value'>1</div>
            <div className='t7-label'>Документ до выпуска денег</div>
          </article>
        </div>

        {/* PARTIES + MONEY */}
        <div className='t7-grid2'>
          <section className='t7-panel'>
            <div className='t7-eyebrow'>Стороны и условия</div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {[
                ['Продавец', 'КФХ Ковалёв А.С.'],
                ['Покупатель', 'ОАО «Агроинвест»'],
                ['Культура', 'Кукуруза'],
                ['Объём', '420 т'],
                ['Цена', '15 200 ₽/т'],
                ['Базис', 'CPT Тамбов'],
                ['Рейс', 'ДОС-2847'],
              ].map(([k, v]) => (
                <div key={k} className='t7-row' style={{ gridTemplateColumns: '120px 1fr' }}>
                  <div className='t7-rowtext'>{k}</div>
                  <div className='t7-rowtitle'>{v}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='t7-panel'>
            <div className='t7-eyebrow'>Денежный контур</div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {[
                { label: 'Резерв подтверждён', value: '6 384 000 ₽', tone: 'success', date: '10.03' },
                { label: 'Hold (спор о качестве)', value: '624 000 ₽', tone: 'danger', date: '15.03' },
                { label: 'К выпуску при закрытии', value: '5 760 000 ₽', tone: 'warn', date: 'Ожидает' },
              ].map(({ label, value, tone, date }) => (
                <div key={label} className='t7-row'>
                  <div>
                    <div className='t7-rowtitle'>{label}</div>
                    <div className='t7-rowtext'>{date}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`t7-chip t7-chip-${tone}`}>{value}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href='/platform-v7/bank' className='t7-btn ghost' style={{ marginTop: 16, width: '100%' }}>
              Подробнее о деньгах
            </Link>
          </section>
        </div>

        {/* DOCUMENTS + TIMELINE */}
        <div className='t7-grid2'>
          <section className='t7-panel'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className='t7-eyebrow'>Документы</div>
              <Link href='/platform-v7/documents' className='t7-cta' style={{ fontSize: 12 }}>Все документы →</Link>
            </div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {docs.map(({ name, status, tone, date }) => (
                <div key={name} className='t7-row'>
                  <div>
                    <div className='t7-rowtitle' style={{ fontSize: 13 }}>{name}</div>
                    <div className='t7-rowtext'>{date}</div>
                  </div>
                  <span className={`t7-chip t7-chip-${tone}`} style={{ fontSize: 11 }}>{status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className='t7-panel'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className='t7-eyebrow'>Лента событий</div>
              <Link href='/platform-v7/control' className='t7-cta' style={{ fontSize: 12 }}>Споры →</Link>
            </div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {timeline.map(({ date, text, tone }) => (
                <div key={date} className='t7-row' style={{ gridTemplateColumns: '72px 1fr' }}>
                  <div className='t7-rowtext' style={{ fontSize: 11 }}>{date}</div>
                  <div>
                    <div className='t7-rowtitle' style={{ fontSize: 13, fontWeight: 500 }}>{text}</div>
                    {tone === 'danger' && <span className='t7-chip t7-chip-danger' style={{ marginTop: 4, fontSize: 10 }}>Критично</span>}
                    {tone === 'warn' && <span className='t7-chip t7-chip-warn' style={{ marginTop: 4, fontSize: 10 }}>Внимание</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
