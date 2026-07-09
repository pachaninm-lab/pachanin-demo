'use client';

import Link from 'next/link';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { InvestorYieldSimulator } from '@/components/platform-v7/InvestorYieldSimulator';
import { SalesFunnelChart } from '@/components/platform-v7/SalesFunnelChart';
import { GrossMarginPanel } from '@/components/platform-v7/GrossMarginPanel';

const METRICS = [
  { label: 'Оборот в проверочном срезе', value: '118 млн ₽', sub: 'Проверочный расчёт, оборот не подтверждён' },
  { label: 'Модель комиссии', value: '1,8%', sub: 'Гипотеза unit economics' },
  { label: 'Сделок в проверочном ряду', value: '31', sub: 'Ряд для проверки UX и экономики' },
  { label: 'Средний цикл', value: '8,3 дн.', sub: 'Расчёт по проверочным данным' },
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
    title: 'Что собрано в интерфейсе',
    items: ['Ролевой вход', 'Контур сделки', 'Деньги без двойного счёта', 'Документы и доказательства', 'Мобильный экран водителя'],
  },
  {
    title: 'Что в контуре исполнения',
    items: ['Маршруты продавца и покупателя', 'Банк как слой оснований', 'Операторская очередь', 'Спор и доказательства', 'Контроль качества UX gates'],
  },
  {
    title: 'Что остаётся проверочным',
    items: ['Оборот и региональный ряд', 'Ответы внешних систем', 'Отправка документов', 'GPS/телематика', 'Банковские действия'],
  },
  {
    title: 'Что требует внешних подтверждений',
    items: ['ФГИС', 'ЭДО/ЭТрН', 'Банк', 'Лаборатория', 'GPS/телематика', 'Реальные договоры и доступы'],
  },
];

const RISKS = [
  { label: 'Интеграции', value: 'требуют договоров, доступов и проверки на фактической сделке' },
  { label: 'Ручная нагрузка', value: 'часть действий пока закрывается оператором и ручной проверкой' },
  { label: 'Данные', value: 'часть метрик основана на проверочном ряду' },
  { label: 'Банк', value: 'выплату должен подтверждать банк, а не платформа' },
];

const PLAN = [
  'Проверить сквозной путь сделки с фактическими участниками',
  'Подготовить доступы и договоры для внешних подключений',
  'Снять ручную операционную нагрузку по ключевым действиям',
  'Подтвердить экономику сделки на фактических данных',
  'Расширять регионы только после повторяемого результата',
];

const SHIPPED = [
  {
    title: 'Проверочный пакет',
    state: 'Контур исполнения',
    note: 'Карта для банка и инвестора: что собрано, что проверяется и что требует подтверждения на фактической сделке.',
    href: '/platform-v7/data-room',
  },
  {
    title: 'Вход и компания',
    state: 'Контур исполнения',
    note: 'Вход, регистрация и подключение компании доступны внутри платформы без заявления неподтверждённой промышленной зрелости.',
    href: '/platform-v7/auth',
  },
  {
    title: 'Факторинг и эскроу',
    state: 'Требует внешнего подтверждения',
    note: 'Банковские поверхности связаны с денежным контуром, но требуют договора, доступа, регламента и приёмки для внешнего применения.',
    href: '/platform-v7/bank',
  },
  {
    title: 'Слой доверия',
    state: 'Контур исполнения',
    note: 'Профиль компании, команда, карточки контрагентов и отзывы доступны как часть UX проверки.',
    href: '/platform-v7/profile',
  },
  {
    title: 'Контур готовности',
    state: 'Контур исполнения',
    note: 'Готовность сервисов и модулей показана честно: внутренний контур отдельно от внешних подключений.',
    href: '/platform-v7/status',
  },
];

export default function InvestorPage() {
  const maxGmv = Math.max(...REGIONS.map((r) => r.gmv));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', margin: 0, borderLeft: '4px solid #0A7A5F', paddingLeft: 12 }}>
            Инвесторский режим
          </h1>
          <p style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', marginTop: 4, paddingLeft: 16 }}>
            Зрелость · экономика · риски · ручная нагрузка · roadmap
          </p>
        </div>
        <TrustDot state='test' size='sm' label='Платформа временно без внешних интеграций · оборот не подтверждён' />
      </div>

      <div data-testid="platform-v7-investor-truth-banner" style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, lineHeight: 1.6 }}>
        Инвесторский экран показывает картину контура исполнения. Оборот, регионы и часть действий являются проверочным рядом. Внешние подключения, банковские операции и фактическое исполнение требуют договоров, доступов и проверки на фактической сделке.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {METRICS.map(({ label, value, sub }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--pc-text-primary, #0F1419)', marginTop: 8, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      <section data-testid="platform-v7-investor-truth-grid" style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Правда по зрелости</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8 }}>
            Экран разделяет готовые UX-слои, контур исполнения, проверочный ряд и внешние подключения. Это снижает риск завышенных ожиданий у инвестора.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {TRUTH_BLOCKS.map((block) => (
            <article key={block.title} style={{ border: '1px solid #EEF1F4', borderRadius: 14, padding: 14, background: '#F8FAFB' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--pc-text-primary, #0F1419)' }}>{block.title}</div>
              <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 6, color: 'var(--pc-text-secondary, #475569)', fontSize: 12, lineHeight: 1.45 }}>
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Что уже собрано в продукте</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8 }}>
            Ключевые слои доступны пользователю, но их статус не смешивается с внешним исполнением.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {SHIPPED.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #475569)', fontSize: 11, fontWeight: 800 }}>{item.state}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--pc-text-secondary, #475569)' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Региональный проверочный срез</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {REGIONS.map((r) => (
              <div key={r.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)' }}>{r.deals} сделок · {r.gmv} млн ₽</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#F1F3F5', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: r.color, width: `${(r.gmv / maxGmv) * 100}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div data-testid="platform-v7-investor-risks" style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20 }}>
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

          <div style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20 }}>
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

      {/* Sales Funnel */}
      <div style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, color: 'var(--pc-text-primary, #0F1419)' }}>Воронка продаж платформы</div>
        <SalesFunnelChart />
      </div>

      {/* Gross Margin by Role */}
      <div style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, color: 'var(--pc-text-primary, #0F1419)' }}>Валовая прибыль по ролям</div>
        <div style={{ fontSize: 11, color: 'var(--pc-text-muted)', marginBottom: 14 }}>Выручка, себестоимость и маржа каждого участника сделки</div>
        <GrossMarginPanel />
      </div>

      {/* Yield calculation */}
      <div style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, color: 'var(--pc-text-primary, #0F1419)' }}>Расчёт доходности</div>
        <InvestorYieldSimulator />
      </div>

      <div style={{ padding: '16px 20px', borderRadius: 16, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Запросить материалы по проверке</div>
          <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', marginTop: 4 }}>Финансовая модель, план роста и проверочный пакет</div>
        </div>
        <a href="mailto:invest@pachanin.рф" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 12, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>
          Написать →
        </a>
      </div>
    </div>
  );
}
