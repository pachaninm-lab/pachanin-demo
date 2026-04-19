import Link from 'next/link';

const SERVICES = [
  {
    id: 'fgis',
    name: 'ФГИС / СДИЗ',
    status: 'ok',
    uptime: '99.4%',
    note: 'Проверка партий и источников работает. Возможны редкие ручные перепроверки.',
    incidents: ['2026-04-11 · краткая деградация ответа API', '2026-04-03 · ручная сверка по 1 партии'],
  },
  {
    id: 'bank',
    name: 'Банк / release callbacks',
    status: 'degraded',
    uptime: '97.8%',
    note: 'Деньги идут, но часть кейсов может уйти в ручную проверку.',
    incidents: ['2026-04-18 · ручная проверка выпуска по 2 сделкам', '2026-04-09 · задержка callback до 14 мин'],
  },
  {
    id: 'spark',
    name: 'СПАРК / контрагенты',
    status: 'ok',
    uptime: '99.1%',
    note: 'Проверка карточек контрагентов проходит штатно.',
    incidents: ['2026-04-07 · обновление профилей'],
  },
  {
    id: 'labs',
    name: 'Лаборатории / протоколы',
    status: 'sandbox',
    uptime: 'Пилот',
    note: 'Предпилотный режим. Часть протоколов ещё загружается вручную.',
    incidents: ['2026-04-15 · ручной ввод протокола по тестовой сделке'],
  },
];

function serviceTone(status: string) {
  if (status === 'ok') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'ОК' };
  if (status === 'degraded') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'Нестабильно' };
  return { bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB', label: 'Песочница' };
}

export default function StatusPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1020, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Статус сервисов</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Операционный статус интеграций и внешних контуров. Это честная витрина состояния: где всё ок, где есть деградация и что ещё работает в предпилотном режиме.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Metric title='ОК' value='2' note='ФГИС и СПАРК проходят штатно.' />
        <Metric title='Нестабильно' value='1' note='Банк иногда уводит кейсы в ручную проверку.' />
        <Metric title='Песочница' value='1' note='Лабораторный контур ещё не полностью боевой.' />
        <Metric title='Режим' value='Pilot' note='Честная стадия: pilot-ready с сопровождением.' />
      </div>

      <section style={{ display: 'grid', gap: 12 }}>
        {SERVICES.map((service) => {
          const tone = serviceTone(service.status);
          return (
            <article key={service.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{service.name}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>{service.note}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 11, fontWeight: 800 }}>
                  {tone.label}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Cell label='Доступность' value={service.uptime} />
                <Cell label='Последнее состояние' value={tone.label} />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F1419', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Последние события</div>
                {service.incidents.map((incident) => (
                  <div key={incident} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#F8FAFB', fontSize: 12, color: '#475569' }}>
                    {incident}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/connectors' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Открыть интеграции
        </Link>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Вернуться в Control Tower
        </Link>
      </div>
    </div>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{note}</div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{value}</div>
    </div>
  );
}
