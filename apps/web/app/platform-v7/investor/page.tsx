'use client';

import Link from 'next/link';

const METRICS = [
  { label: 'Оборот в демо-срезе', value: '118 млн ₽', sub: '+30% к марту' },
  { label: 'Комиссия платформы', value: '1,8%', sub: 'Модель дохода платформы' },
  { label: 'Активных сделок', value: '31', sub: 'Пик по текущему ряду' },
  { label: 'Средний цикл', value: '8,3 дн.', sub: 'От контракта до расчёта' },
];

const REGIONS = [
  { name: 'Тамбовская', deals: 8, gmv: 38.4, color: '#0A7A5F' },
  { name: 'Воронежская', deals: 7, gmv: 32.1, color: '#0B6B9A' },
  { name: 'Курская', deals: 5, gmv: 22.1, color: '#2563EB' },
  { name: 'Белгородская', deals: 4, gmv: 17.2, color: '#7C3AED' },
  { name: 'Ставропольский', deals: 4, gmv: 43.5, color: '#D97706' },
  { name: 'Ростовская', deals: 3, gmv: 12.6, color: '#DC2626' },
];

const PLAN = [
  'Подключение ФГИС в боевой контур после управляемого пилота',
  'Пилот с тремя агрохолдингами ЮФО',
  'Мобильный кабинет для водителей и элеваторов',
  'Доступ для банков-партнёров после подтверждения пилотного контура',
  'Расширение на 15 регионов после проверки экономики сделки',
];

const TRUST = [
  { label: 'Просрочка по сделкам', value: '0%', good: true },
  { label: 'Спорность', value: '8%', good: true },
  { label: 'Покрытие ФГИС в песочнице', value: '100%', good: true },
  { label: 'Активных сделок', value: '31', good: true },
];

const SHIPPED = [
  {
    title: 'Пакет проверки',
    state: 'Встроено',
    note: 'Честная карта для банка и инвестора: что собрано, что в песочнице и что требует пилота.',
    href: '/platform-v7/data-room',
  },
  {
    title: 'Вход и подключение компании',
    state: 'Встроено',
    note: 'Вход, регистрация и подключение компании уже внутри платформы.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Факторинг и эскроу',
    state: 'Встроено',
    note: 'Банковские поверхности оформлены и связаны с денежным контуром в песочнице.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Слой доверия',
    state: 'Встроено',
    note: 'Профиль компании, команда, карточки контрагентов и отзывы по сделкам уже доступны.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Контур готовности',
    state: 'Встроено',
    note: 'Есть отдельный слой готовности сервисов и новых модулей.',
    href: '/platform-v7/status',
  },
];

export default function InvestorPage() {
  const maxGmv = Math.max(...REGIONS.map((r) => r.gmv));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: 0, borderLeft: '4px solid #0A7A5F', paddingLeft: 12 }}>
          Инвестор и раунд
        </h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4, paddingLeft: 16 }}>
          Показатели доверия · Операционные показатели · План развития
        </p>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#0F1419', fontSize: 13, lineHeight: 1.6 }}>
        Страница показывает демонстрационный инвестиционный срез. Боевые интеграции, подтверждённый оборот и полная готовность не заявляются без управляемого пилота.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {METRICS.map(({ label, value, sub }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0F1419', marginTop: 8, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что уже встроено в продукт</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Ключевые P1-слои встроены в платформу и доступны пользователю. Статус интеграций остаётся честно ограниченным: песочница или управляемый пилот.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {SHIPPED.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 800 }}>{item.state}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Распределение по регионам</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {REGIONS.map((r) => (
              <div key={r.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: '#6B778C' }}>{r.deals} сделок · {r.gmv} млн ₽</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#F1F3F5', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: r.color, width: `${(r.gmv / maxGmv) * 100}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Показатели доверия</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {TRUST.map(({ label, value, good }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: good ? 'rgba(10,122,95,0.06)' : 'rgba(220,38,38,0.06)', border: `1px solid ${good ? 'rgba(10,122,95,0.14)' : 'rgba(220,38,38,0.14)'}` }}>
                  <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: good ? '#0A7A5F' : '#B91C1C' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>План на 90 дней</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
              {PLAN.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 999, background: '#0A7A5F', color: '#fff', fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', borderRadius: 16, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Запросить материалы по раунду</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Финансовая модель, план роста и проверочный пакет</div>
        </div>
        <a href="mailto:invest@pachanin.ru" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 12, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
          Написать →
        </a>
      </div>
    </div>
  );
}
