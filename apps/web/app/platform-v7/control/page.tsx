import Link from 'next/link';

const timeline = [
  { date: '15.03 14:30', actor: 'Банк', text: 'Введён hold 624 000 ₽ — ожидание решения по качеству', tone: 'danger' },
  { date: '15.03 09:00', actor: 'Банк', text: 'Callback CB-442 — mismatch. Ручная сверка обязательна', tone: 'warn' },
  { date: '14.03 16:00', actor: 'Продавец', text: 'Загружен паспорт качества ФГИС Зерно', tone: 'success' },
  { date: '13.03 11:00', actor: 'Лаборатория', text: 'Протокол ЛАБ-2847: расхождение протеина 0.8% от базиса', tone: 'warn' },
  { date: '12.03 08:30', actor: 'Покупатель', text: 'Зафиксировано расхождение качества при приёмке', tone: 'danger' },
] as const;

const evidence = [
  { name: 'Паспорт качества ФГИС Зерно', date: '14.03.2026', author: 'Продавец', status: 'Загружен', tone: 'success' },
  { name: 'Протокол испытаний ЛАБ-2847', date: '13.03.2026', author: 'Лаборатория', status: 'Загружен', tone: 'success' },
  { name: 'Фотофиксация разгрузки', date: '12.03.2026', author: 'Водитель', status: 'Загружен', tone: 'success' },
  { name: 'Акт несоответствия', date: '12.03.2026', author: 'Покупатель', status: 'Загружен', tone: 'success' },
  { name: 'Заключение независимого эксперта', date: '—', author: 'Покупатель', status: 'Не загружен', tone: 'warn' },
] as const;

// SLA: 6 of ~15 days used ≈ 40%
const SLA_DAYS_LEFT = 6;
const SLA_TOTAL = 15;
const SLA_PCT = Math.round(((SLA_TOTAL - SLA_DAYS_LEFT) / SLA_TOTAL) * 100);

export default function ControlPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO — war-room */}
        <section className='t7-hero' style={{ borderLeft: '4px solid var(--control)', background: 'linear-gradient(135deg,rgba(124,58,237,.05),rgba(220,38,38,.03))' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className='t7-chip t7-chip-control'>КОНТРОЛЬ · WAR-ROOM</span>
            <span className='t7-chip t7-chip-danger'>Активный спор</span>
            <span className='t7-chip t7-chip-warn'>SLA: 6 дней</span>
          </div>
          <h1 className='t7-h1'>DK-2024-89 · Несоответствие качества зерна</h1>
          <p className='t7-lead'>
            Спор, деньги под hold, доказательства, ответственные и SLA — в одном месте.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/deal' className='t7-btn primary' style={{ background: 'var(--control)', borderColor: 'transparent' }}>
              Добавить доказательство
            </Link>
            <Link href='/platform-v7/deal' className='t7-btn danger'>Запросить арбитраж</Link>
            <Link href='/platform-v7/bank' className='t7-btn ghost'>Статус hold</Link>
          </div>
        </section>

        {/* METRICS */}
        <div className='t7-grid4'>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-control'>Кейс</span>
            <div className='t7-value'>1</div>
            <div className='t7-label'>Открытый спор</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip t7-chip-danger'>Удержание</span>
            <div className='t7-value' style={{ color: 'var(--danger)' }}>624 000 ₽</div>
            <div className='t7-label'>Заморожены до решения</div>
          </article>
          {/* SLA with progress */}
          <article className='t7-card'>
            <span className='t7-chip t7-chip-warn'>SLA осталось</span>
            <div className='t7-value' style={{ color: '#b45309' }}>{SLA_DAYS_LEFT} дней</div>
            <div className='t7-label'>До 18.04.2026</div>
            <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{ width: `${SLA_PCT}%`, height: '100%', borderRadius: 999, background: 'var(--warn)' }} />
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>{SLA_PCT}% времени израсходовано</div>
          </article>
          <article className='t7-card'>
            <span className='t7-chip'>Доказательства</span>
            <div className='t7-value'>4 / 5</div>
            <div className='t7-label'>Evidence pack почти готов</div>
            <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{ width: '80%', height: '100%', borderRadius: 999, background: 'var(--indigo)' }} />
            </div>
          </article>
        </div>

        {/* CASE DETAIL + EVIDENCE */}
        <div className='t7-grid2'>
          <section className='t7-panel'>
            <div className='t7-eyebrow'>Детали кейса</div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {[
                ['ID', 'DK-2024-89'],
                ['Сделка', 'DL-9102'],
                ['Тип', 'Несоответствие качества'],
                ['Продавец', 'КФХ Ковалёв А.С.'],
                ['Покупатель', 'ОАО «Агроинвест»'],
                ['Owner', 'Иванов А.С.'],
                ['SLA до', '18.04.2026'],
                ['Сумма под hold', '624 000 ₽'],
              ].map(([k, v]) => (
                <div key={k} className='t7-row' style={{ gridTemplateColumns: '116px 1fr' }}>
                  <div className='t7-rowtext'>{k}</div>
                  <div className='t7-rowtitle' style={{ fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>
            <Link href='/platform-v7/deal' className='t7-btn ghost' style={{ marginTop: 14, width: '100%' }}>
              Открыть сделку DL-9102
            </Link>
          </section>

          <section className='t7-panel'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className='t7-eyebrow'>Пакет доказательств</div>
              <span className='t7-chip t7-chip-warn'>Не хватает 1</span>
            </div>
            <div className='t7-list' style={{ marginTop: 14 }}>
              {evidence.map(({ name, date, author, status, tone }) => (
                <div key={name} className='t7-row'>
                  <div>
                    <div className='t7-rowtitle' style={{ fontSize: 13 }}>{name}</div>
                    <div className='t7-rowtext'>{author} · {date}</div>
                  </div>
                  <span className={`t7-chip t7-chip-${tone}`} style={{ fontSize: 10 }}>{status}</span>
                </div>
              ))}
            </div>
            <Link href='/platform-v7/deal' className='t7-btn primary' style={{ marginTop: 16, width: '100%', background: 'var(--control)', borderColor: 'transparent' }}>
              Загрузить заключение эксперта
            </Link>
          </section>
        </div>

        {/* TIMELINE */}
        <section className='t7-panel'>
          <div className='t7-eyebrow'>Лента событий спора</div>
          <div className='t7-list' style={{ marginTop: 14 }}>
            {timeline.map(({ date, actor, text, tone }) => (
              <div key={date + actor} className='t7-row' style={{ gridTemplateColumns: '90px 1fr' }}>
                <div>
                  <div className='t7-rowtext' style={{ fontSize: 11 }}>{date}</div>
                  <div className='t7-rowtext' style={{ fontSize: 11, marginTop: 2, fontWeight: 600 }}>{actor}</div>
                </div>
                <div>
                  <div className='t7-rowtitle' style={{ fontSize: 13, fontWeight: 500 }}>{text}</div>
                  <span className={`t7-chip t7-chip-${tone}`} style={{ marginTop: 6, fontSize: 10 }}>
                    {tone === 'danger' ? 'Критично' : tone === 'warn' ? 'Внимание' : 'Факт'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* NEXT STEPS */}
        <section className='t7-panel' style={{ background: 'rgba(124,58,237,.03)', border: '1px solid rgba(124,58,237,.14)' }}>
          <div className='t7-eyebrow'>Следующие шаги</div>
          <div className='t7-list' style={{ marginTop: 12 }}>
            {[
              { step: '1', text: 'Загрузить заключение независимого эксперта', who: 'Покупатель', urgent: true },
              { step: '2', text: 'Ручной разбор CB-442 в банке', who: 'Банк', urgent: true },
              { step: '3', text: 'Получить решение арбитража', who: 'Контроль', urgent: false },
              { step: '4', text: 'Выпустить или вернуть 624 000 ₽', who: 'Банк', urgent: false },
            ].map(({ step, text, who, urgent }) => (
              <div key={step} className='t7-row' style={{ gridTemplateColumns: '28px 1fr' }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: urgent ? 'var(--danger)' : 'var(--indigo)',
                  color: '#fff', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1
                }}>{step}</div>
                <div>
                  <div className='t7-rowtitle' style={{ fontSize: 14 }}>{text}</div>
                  <div className='t7-rowtext'>{who}</div>
                </div>
              </div>
            ))}
          </div>
          <div className='t7-actions'>
            <Link href='/platform-v7/deal' className='t7-btn primary' style={{ background: 'var(--control)', borderColor: 'transparent' }}>
              Добавить доказательство
            </Link>
            <Link href='/platform-v7/deal' className='t7-btn'>Выслать уведомление</Link>
            <Link href='/platform-v7/bank' className='t7-btn ghost'>Статус callbacks</Link>
          </div>
        </section>

      </div>
    </div>
  );
}
