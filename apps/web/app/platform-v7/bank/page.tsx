import Link from 'next/link';

const operations = [
  { type: 'Резерв', desc: 'Подтверждён в полном объёме', amount: '6 384 000 ₽', date: '10.03.2026', tone: 'success' },
  { type: 'Hold', desc: 'Введён — спор DK-2024-89 по качеству', amount: '624 000 ₽', date: '15.03.2026', tone: 'danger' },
  { type: 'Release', desc: 'Ожидает: нужен акт приёмки и форма ЗТТ', amount: '5 760 000 ₽', date: 'Ожидает', tone: 'warn' },
] as const;

const callbacks = [
  { id: 'CB-441', type: 'Резерв', deal: 'DL-9102', status: 'OK', note: 'Подтверждено автоматически', date: '11.03 09:12', tone: 'success' },
  { id: 'CB-442', type: 'Качество', deal: 'DL-9102', status: 'Mismatch', note: 'Расхождение 0.8% — ручная сверка', date: '11.03 14:30', tone: 'danger' },
  { id: 'CB-443', type: 'Финал', deal: 'DL-9102', status: 'Ожидает', note: 'Зависит от разрешения CB-442', date: '—', tone: 'warn' },
] as const;

const blockingDocs = [
  { name: 'Акт приёмки (форма А)', owner: 'Продавец', impact: '3 200 000 ₽' },
  { name: 'Форма ЗТТ', owner: 'Продавец + Покупатель', impact: 'Подтверждение сделки' },
] as const;

export default function BankPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero'>
          <span className='t7-chip t7-chip-bank'>БАНК</span>
          <h1 className='t7-h1'>Reserve, hold, release — без лишнего шума</h1>
          <p className='t7-lead'>
            Строгий операционный кабинет: резерв, удержание, выпуск и callbacks.
            Каждое действие — с основанием и статусом.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/deal' className='t7-btn primary'>Подтвердить резерв</Link>
            <Link href='/platform-v7/deal' className='t7-btn'>Выпустить средства</Link>
            <Link href='/platform-v7/control' className='t7-btn ghost'>Спор DK-2024-89</Link>
          </div>
        </section>

        {/* METRICS */}
        <div className='t7-grid4'>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-bank'>Резерв</span>
            <div className='t7-value' style={{ color: 'var(--bank)' }}>6 384 000 ₽</div>
            <div className='t7-label'>Под контролем банка</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-danger'>Hold</span>
            <div className='t7-value' style={{ color: 'var(--danger)' }}>624 000 ₽</div>
            <div className='t7-label'>Спор о качестве DK-2024-89</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-warn'>К выпуску</span>
            <div className='t7-value'>5 760 000 ₽</div>
            <div className='t7-label'>При закрытии документов</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-danger'>Mismatch</span>
            <div className='t7-value'>1</div>
            <div className='t7-label'>CB-442 требует ручной сверки</div>
          </article>
        </div>

        {/* OPERATIONS */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>Операции по DL-9102</div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {operations.map(({ type, desc, amount, date, tone }) => (
              <div key={type} className='t7-row'>
                <div>
                  <div className='t7-rowtitle'>{type}</div>
                  <div className='t7-rowtext'>{desc} · {date}</div>
                </div>
                <span className={`t7-chip t7-chip-${tone}`}>{amount}</span>
              </div>
            ))}
          </div>
        </section>

        {/* BLOCKING DOCS */}
        <section className='t7-panel' style={{ border: '1px solid rgba(245,158,11,.2)', background: 'rgba(245,158,11,.03)' }}>
          <div className='t7-eyebrow' style={{ color: '#b45309' }}>Что блокирует release</div>
          <div className='t7-list' style={{ marginTop: 12 }}>
            {blockingDocs.map(({ name, owner, impact }) => (
              <div key={name} className='t7-row'>
                <div>
                  <div className='t7-rowtitle' style={{ fontSize: 14 }}>{name}</div>
                  <div className='t7-rowtext'>Ответственный: {owner}</div>
                </div>
                <span className='t7-chip t7-chip-warn'>{impact}</span>
              </div>
            ))}
          </div>
          <Link href='/platform-v7/documents' className='t7-btn ghost' style={{ marginTop: 14, width: '100%' }}>
            Перейти к документам →
          </Link>
        </section>

        {/* CALLBACKS */}
        <section className='t7-panel'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className='t7-eyebrow'>Callbacks</div>
            <span className='t7-chip t7-chip-danger'>1 требует внимания</span>
          </div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {callbacks.map(({ id, type, deal, status, note, date, tone }) => (
              <Link
                key={id}
                href={tone === 'danger' ? '/platform-v7/control' : '/platform-v7/deal'}
                className='t7-row'
                style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', borderRadius: 8, margin: '0 -8px', padding: '13px 8px' }}
              >
                <div>
                  <div className='t7-rowtitle'>{id} · {type} · {deal}</div>
                  <div className='t7-rowtext'>{note}</div>
                  <div className='t7-rowtext'>{date}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span className={`t7-chip t7-chip-${tone}`}>{status}</span>
                  {tone === 'danger' && <span className='t7-small'>→ Спор</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* MISMATCH ALERT */}
        <section className='t7-panel' style={{ border: '1px solid rgba(220,38,38,.2)', background: 'rgba(220,38,38,.03)' }}>
          <div className='t7-eyebrow' style={{ color: 'var(--danger)' }}>Требует ручного разбора</div>
          <h2 className='t7-h2' style={{ marginTop: 10, color: 'var(--danger)', fontSize: 17 }}>
            CB-442 · Mismatch по качеству · DL-9102
          </h2>
          <p className='t7-text' style={{ marginTop: 8 }}>
            Расхождение протеина 0.8% между паспортом ФГИС Зерно и протоколом лаборатории ЛАБ-2847.
            Холдирование 624 000 ₽ активно до решения по спору DK-2024-89.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/control' className='t7-btn danger'>Перейти к спору →</Link>
            <Link href='/platform-v7/deal' className='t7-btn'>Открыть сделку</Link>
          </div>
        </section>

      </div>
    </div>
  );
}
