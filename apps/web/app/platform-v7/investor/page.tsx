'use client';

import Link from 'next/link';

const METRICS = [
  { label: 'Оборот в тестовом срезе', value: '118 млн ₽', sub: 'Данные сценария, не подтверждённый GMV' },
  { label: 'Модель комиссии', value: '1,8%', sub: 'Гипотеза unit economics для пилота' },
  { label: 'Сделок в сценарии', value: '31', sub: 'Тестовый ряд для проверки UX' },
  { label: 'Средний цикл', value: '8,3 дн.', sub: 'Расчёт по сценарным данным' },
];

const REGIONS = [
  { name: 'Тамбовская', deals: 8, gmv: 38.4, color: '#0A7A5F' },
  { name: 'Воронежская', deals: 7, gmv: 32.1, color: '#0B6B9A' },
  { name: 'Курская', deals: 5, gmv: 22.1, color: '#2563EB' },
  { name: 'Белгородская', deals: 4, gmv: 17.2, color: '#7C3AED' },
  { name: 'Ставропольский', deals: 4, gmv: 43.5, color: '#D97706' },
  { name: 'Ростовская', deals: 3, gmv: 12.6, color: '#DC2626' },
];

const TRUTH_BLOCKS = [
  {
    title: 'Что доказано интерфейсом',
    items: ['Ролевой вход', 'Контур сделки', 'Деньги без двойного счёта', 'Документы и доказательства', 'Мобильный экран водителя'],
  },
  {
    title: 'Что в пилотном контуре',
    items: ['Сценарии продавца и покупателя', 'Банк как проверочный слой', 'Операторская очередь', 'Спор и доказательства', 'Контроль качества UX gates'],
  },
  {
    title: 'Что остаётся тестовым',
    items: ['Оборот и региональный ряд', 'Ответы внешних систем', 'Отправка документов', 'GPS/телематика', 'Банковские действия'],
  },
  {
    title: 'Что требует live-подключений',
    items: ['ФГИС', 'ЭДО/ЭТрН', 'Банк', 'Лаборатория', 'GPS/телематика', 'Реальные договоры и доступы'],
  },
];

const RISKS = [
  { label: 'Интеграции', value: 'требуют договоров, доступов и проверки на реальной сделке' },
  { label: 'Ручная нагрузка', value: 'часть действий пока закрывается оператором и тестовыми сценариями' },
  { label: 'Данные', value: 'часть метрик основана на демонстрационном ряду' },
  { label: 'Банк', value: 'выпуск денег должен подтверждать банк, а не платформа' },
];

const PLAN = [
  'Проверить сквозной сценарий сделки с реальными участниками пилота',
  'Подготовить доступы и договоры для внешних подключений',
  'Снять ручную операционную нагрузку по ключевым действиям',
  'Подтвердить экономику сделки на фактических данных',
  'Расширять регионы только после повторяемого пилотного результата',
];

const SHIPPED = [
  {
    title: 'Проверочный пакет',
    state: 'Пилотный контур',
    note: 'Карта для банка и инвестора: что собрано, что тестовое и что требует проверки на реальной сделке.',
    href: '/platform-v7/data-room',
  },
  {
    title: 'Вход и компания',
    state: 'Пилотный контур',
    note: 'Вход, регистрация и подключение компании доступны внутри платформы, без заявления боевой зрелости.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Факторинг и эскроу',
    state: 'Тестовый режим',
    note: 'Банковские поверхности связаны с денежным контуром, но требуют внешнего подтверждения для реального применения.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Слой доверия',
    state: 'Пилотный контур',
    note: 'Профиль компании, команда, карточки контрагентов и отзывы доступны как часть проверочного UX.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Контур готовности',
    state: 'Пилотный контур',
    note: 'Готовность сервисов и модулей показана честно: тестовый режим отдельно от live-подключений.',
    href: '/platform-v7/status',
  },
];

export default function InvestorPage() {
  const maxGmv = Math.max(...REGIONS.map((r) => r.gmv));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', margin: 0, borderLeft: '4px solid #0A7A5F', paddingLeft: 12 }}>
          Инвесторский режим
        </h1>
        <p style={{ fontSize: 13, color: '#6B778C', marginTop: 4, paddingLeft: 16 }}>
          Зрелость · экономика · риски · ручная нагрузка · roadmap
        </p>
      </div>

      <div data-testid="platform-v7-investor-truth-banner" style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#0F1419', fontSize: 13, lineHeight: 1.6 }}>
        Инвесторский экран показывает controlled-pilot картину. Оборот, регионы и часть действий являются тестовым сценарием. Внешние подключения, банковские операции и реальное исполнение требуют договоров, доступов и проверки на фактической сделке.
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

      <section data-testid="platform-v7-investor-truth-grid" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Правда по зрелости</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Экран разделяет готовые UX-слои, пилотный контур, тестовый сценарий и live-подключения. Это снижает риск завышенных ожиданий у инвестора.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {TRUTH_BLOCKS.map((block) => (
            <article key={block.title} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 14, background: '#F8FAFB' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0F1419' }}>{block.title}</div>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 6, color: '#475569', fontSize: 12, lineHeight: 1.45 }}>
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Что уже собрано в продукте</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Ключевые слои доступны пользователю, но их статус не смешивается с реальным внешним исполнением.
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
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Региональный тестовый срез</div>
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
          <div data-testid="platform-v7-investor-risks" style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Риски и ручная нагрузка</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {RISKS.map(({ label, value }) => (
                <div key={label} style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 10, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.14)' }}>
                  <span style={{ fontSize: 12, color: '#92400E', fontWeight: 900 }}>{label}</span>
                  <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.45 }}>{value}</span>
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
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>Запросить материалы по пилоту</div>
          <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Финансовая модель, план роста и проверочный пакет</div>
        </div>
        <a href="mailto:invest@pachanin.ru" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 12, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
          Написать →
        </a>
      </div>
    </div>
  );
}
