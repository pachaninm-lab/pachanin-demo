import Link from 'next/link';

const critical = [
  { name: 'Акт приёмки (форма А)', owner: 'Продавец', impact: 'Блокирует 3 200 000 ₽', status: 'Не загружен', tone: 'danger' },
  { name: 'Форма ЗТТ', owner: 'Продавец + Покупатель', impact: 'Блокер подтверждения', status: 'На подписи', tone: 'warn' },
] as const;

const upcoming = [
  { name: 'Транспортная накладная', when: 'При доставке · ~2 дня', owner: 'Водитель' },
  { name: 'Сертификат качества', when: 'При закрытии · ~5 дней', owner: 'Лаборатория' },
  { name: 'Акт сверки расчётов', when: 'При выпуске · ~7 дней', owner: 'Банк' },
] as const;

const uploaded = [
  { name: 'Договор поставки', deal: 'DL-9102', date: '06.03.2026', size: '248 КБ' },
  { name: 'Счёт-фактура', deal: 'DL-9102', date: '07.03.2026', size: '120 КБ' },
  { name: 'Паспорт качества ФГИС', deal: 'DL-9102', date: '14.03.2026', size: '512 КБ' },
  { name: 'Транспортная накладная', deal: 'DL-9102', date: '12.03.2026', size: '96 КБ' },
  { name: 'Протокол ЛАБ-2847', deal: 'DL-9102', date: '13.03.2026', size: '384 КБ' },
  { name: 'Фотофиксация разгрузки', deal: 'DL-9102', date: '12.03.2026', size: '1.2 МБ' },
  { name: 'Доверенность водителя', deal: 'DL-9102', date: '10.03.2026', size: '64 КБ' },
  { name: 'Карантинный сертификат', deal: 'DL-9102', date: '08.03.2026', size: '188 КБ' },
] as const;

export default function DocumentsPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero'>
          <span className='t7-chip t7-chip-docs'>ДОКУМЕНТЫ</span>
          <h1 className='t7-h1'>Комплектность — gate для выпуска денег</h1>
          <p className='t7-lead'>
            Статус каждого документа напрямую влияет на движение денег.
            Не папка с PDF — операционный контроль пакета.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/deal' className='t7-btn primary'>Загрузить документ</Link>
            <Link href='/platform-v7/deal' className='t7-btn'>Запросить подписание</Link>
            <Link href='/platform-v7/deal' className='t7-btn ghost'>Сделка DL-9102</Link>
          </div>
        </section>

        {/* COMPLETENESS */}
        <section className='t7-panel'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className='t7-eyebrow'>Полнота пакета · DL-9102</div>
            <span className='t7-chip t7-chip-warn'>1 блокирует выпуск</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 14 }}>
            <div className='t7-value' style={{ color: 'var(--docs)', marginTop: 0 }}>92%</div>
            <div className='t7-label' style={{ marginTop: 0 }}>11 из 12 обязательных документов загружены</div>
          </div>
          <div className='t7-progress'><span style={{ width: '92%' }} /></div>
          <div className='t7-text' style={{ marginTop: 10 }}>
            Недостающий документ: <strong>Акт приёмки (форма А)</strong> — ответственный: Продавец
          </div>
        </section>

        {/* METRICS */}
        <div className='t7-grid4'>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-success'>Загружено</span>
            <div className='t7-value'>11 / 12</div>
            <div className='t7-label'>Обязательных документов</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-warn'>Ожидают</span>
            <div className='t7-value'>2</div>
            <div className='t7-label'>Требуют действия сейчас</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-danger'>Блокирует</span>
            <div className='t7-value'>1</div>
            <div className='t7-label'>Документ останавливает release</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip'>В архиве</span>
            <div className='t7-value'>8</div>
            <div className='t7-label'>Подтверждённых документов</div>
          </article>
        </div>

        {/* CRITICAL NOW — most prominent */}
        <section className='t7-panel' style={{ border: '2px solid rgba(220,38,38,.22)', background: 'rgba(220,38,38,.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div className='t7-eyebrow' style={{ color: 'var(--danger)' }}>Критично сейчас — блокируют деньги</div>
            <span className='t7-chip t7-chip-danger'>Деньги заморожены</span>
          </div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {critical.map(({ name, owner, impact, status, tone }) => (
              <div key={name} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{name}</div>
                  <div className='t7-rowtext'>Ответственный: {owner}</div>
                  <div className='t7-rowtext' style={{ color: tone === 'danger' ? 'var(--danger)' : '#b45309', fontWeight: 600, marginTop: 2 }}>
                    {impact}
                  </div>
                </div>
                <span className={`t7-chip t7-chip-${tone}`}>{status}</span>
              </div>
            ))}
          </div>
          <Link href='/platform-v7/deal' className='t7-btn primary' style={{ marginTop: 16 }}>
            Загрузить акт приёмки →
          </Link>
        </section>

        {/* UPCOMING */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>Скоро потребуются</div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {upcoming.map(({ name, when, owner }) => (
              <div key={name} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{name}</div>
                  <div className='t7-rowtext'>{when} · {owner}</div>
                </div>
                <span className='t7-chip'>Запланировано</span>
              </div>
            ))}
          </div>
        </section>

        {/* UPLOADED ARCHIVE */}
        <section className='t7-panel'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className='t7-eyebrow'>Загруженные документы</div>
            <span className='t7-chip t7-chip-success'>{uploaded.length} файлов</span>
          </div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {uploaded.map(({ name, deal, date, size }) => (
              <Link
                key={name}
                href='/platform-v7/deal'
                className='t7-row'
                style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', borderRadius: 8, margin: '0 -8px', padding: '13px 8px' }}
              >
                <div>
                  <div className='t7-rowtitle' style={{ fontSize: 13 }}>{name}</div>
                  <div className='t7-rowtext'>{deal} · {date} · {size}</div>
                </div>
                <span className='t7-chip t7-chip-success'>Загружен</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
