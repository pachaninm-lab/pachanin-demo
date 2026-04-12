import Link from 'next/link';

export default function DriverPage() {
  return (
    <div className='t7-frame'>
      <div className='t7-stack'>

        {/* HERO */}
        <section className='t7-hero' style={{ borderLeft: '4px solid var(--driver)', paddingLeft: 20 }}>
          <span className='t7-chip t7-chip-driver'>ВОДИТЕЛЬ · РЕЙС ДОС-2847</span>
          <h1 className='t7-h1'>Один экран — один шаг</h1>
          <p className='t7-lead'>
            Полевая логика без лишнего шума. Текущее действие, статус GPS и offline-очередь.
          </p>
        </section>

        {/* MAIN ACTION */}
        <section className='t7-hero' style={{ background: 'linear-gradient(135deg,rgba(249,115,22,.07),rgba(249,115,22,.02))' }}>
          <div className='t7-eyebrow' style={{ color: 'var(--driver)' }}>Следующий шаг</div>
          <div style={{ fontSize: 'clamp(1.6rem,6vw,2.2rem)', fontWeight: 800, marginTop: 10, lineHeight: 1.15 }}>
            Подтвердить прибытие на площадку
          </div>
          <div className='t7-text' style={{ marginTop: 10 }}>
            Элеватор Черноземный · Тамбовская обл. · ETA 14:30
          </div>
          <div className='t7-actions'>
            <Link
              href='/platform-v7/deal'
              className='t7-btn primary big'
              style={{ background: 'var(--driver)', borderColor: 'transparent', flex: '1 1 auto', maxWidth: 420 }}
            >
              ✓ Подтвердить прибытие
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <span className='t7-chip t7-chip-success'>GPS активен</span>
            <span className='t7-chip t7-chip-warn'>2 события offline</span>
            <span className='t7-chip'>Кукуруза · 20 т</span>
          </div>
        </section>

        {/* TRIP INFO + OFFLINE QUEUE */}
        <div className='t7-grid2'>
          <section className='t7-panel'>
            <div className='t7-eyebrow'>Рейс</div>
            <div className='t7-list' style={{ marginTop: 12 }}>
              {[
                ['Номер рейса', 'ДОС-2847'],
                ['Маршрут', 'Тамбов → Черноземный'],
                ['ETA', '14:30 (~45 мин)'],
                ['Водитель', 'Ковалёв А.С.'],
                ['ТС', 'В 445 АА 68'],
                ['Груз', 'Кукуруза · 20 т'],
                ['Сделка', 'DL-9102'],
              ].map(([k, v]) => (
                <div key={k} className='t7-row' style={{ gridTemplateColumns: '110px 1fr' }}>
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
            <div className='t7-eyebrow'>Офлайн-очередь</div>
            <div className='t7-list' style={{ marginTop: 12 }}>
              {[
                { time: '11:42', event: 'Прибытие на пункт загрузки', tone: 'success' },
                { time: '12:15', event: 'Загрузка завершена — 20 т', tone: 'warn' },
                { time: '13:05', event: 'Выезд с элеватора отправки', tone: 'warn' },
              ].map(({ time, event, tone }) => (
                <div key={time} className='t7-row' style={{ gridTemplateColumns: '46px 1fr' }}>
                  <div className='t7-rowtext' style={{ fontSize: 11, paddingTop: 2 }}>{time}</div>
                  <div>
                    <div className='t7-rowtitle' style={{ fontSize: 13 }}>{event}</div>
                    <span className={`t7-chip t7-chip-${tone}`} style={{ marginTop: 4, fontSize: 10 }}>
                      {tone === 'success' ? 'Отправлено' : 'Ожидает связи'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className='t7-text' style={{
              marginTop: 14, padding: '10px 12px',
              background: 'rgba(245,158,11,.07)', borderRadius: 10,
              border: '1px solid rgba(245,158,11,.18)', fontSize: 13
            }}>
              2 события отправятся автоматически при восстановлении связи
            </div>
          </section>
        </div>

        {/* EMERGENCY */}
        <section className='t7-panel' style={{ border: '1px solid rgba(220,38,38,.18)', background: 'rgba(220,38,38,.03)' }}>
          <div className='t7-eyebrow' style={{ color: 'var(--danger)' }}>Аварийный блок</div>
          <p className='t7-text' style={{ marginTop: 8 }}>
            Проблема с грузом, ДТП, отказ в приёмке или другая нештатная ситуация?
            Зафиксируй в системе — это создаст кейс в контроле.
          </p>
          <div className='t7-actions'>
            <Link href='/platform-v7/control' className='t7-btn danger'>
              ⚠ Сообщить о проблеме
            </Link>
            <Link href='/platform-v7/deal' className='t7-btn'>Открыть сделку</Link>
          </div>
        </section>

      </div>
    </div>
  );
}
