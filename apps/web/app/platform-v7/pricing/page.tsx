import Link from 'next/link';

const PLANS = [
  {
    name: 'Free',
    price: '0 ₽',
    note: 'До 10 сделок',
    features: [
      'Базовый реестр сделок и лотов',
      '1 рабочая роль на компанию',
      'Документы сделки и история событий',
      'Подходит для первого теста контура',
    ],
    accent: '#475569',
    border: '#E4E6EA',
    bg: '#fff',
  },
  {
    name: 'Growth',
    price: '0.7% take-rate',
    note: 'Рабочий контур',
    features: [
      'Сделка → логистика → документы → деньги',
      'Control Tower и operator actions',
      'Споры, удержания, пакет доказательств',
      'Подходит для пилота и якорного клиента',
    ],
    accent: '#0A7A5F',
    border: 'rgba(10,122,95,0.18)',
    bg: 'linear-gradient(180deg, rgba(10,122,95,0.08), rgba(10,122,95,0.02))',
  },
  {
    name: 'Enterprise',
    price: 'Индивидуально',
    note: 'Банк / регион / холдинг',
    features: [
      'Расширенный внешний контур и доступы',
      'Интеграции и брендирование',
      'Отдельная настройка процессов и ролей',
      'Подходит для крупного внедрения',
    ],
    accent: '#0F1419',
    border: '#E4E6EA',
    bg: '#fff',
  },
];

const MONETIZATION_MODULES = [
  {
    title: 'Факторинг',
    note: 'Дополнительный денежный слой на стороне покупателя и оборотного финансирования.',
    href: '/platform-v7/bank/factoring',
  },
  {
    title: 'Эскроу',
    note: 'Контур безопасной сделки с раскрытием денег по подтверждённым условиям.',
    href: '/platform-v7/bank/escrow',
  },
  {
    title: 'Онбординг компании',
    note: 'Точка входа в коммерческий контур: подключение компании, документов и банка.',
    href: '/platform-v7/onboarding',
  },
  {
    title: 'Профиль и доверие',
    note: 'Карточки контрагентов, отзывы и доверительный слой после сделки.',
    href: '/platform-v7/profile',
  },
];

export default function PricingPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1060, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Тарифы</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Честная упаковка модели. Здесь видно, кто платит, за что платит и на каком этапе продукт подходит клиенту.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {PLANS.map((plan) => (
          <section key={plan.name} style={{ background: plan.bg, border: `1px solid ${plan.border}`, borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: plan.accent }}>{plan.name}</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: plan.accent }}>{plan.price}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', fontWeight: 700 }}>{plan.note}</div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {plan.features.map((feature) => (
                <div key={feature} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 900 }}>•</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Ориентир по комиссии</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Для модели Growth ориентир — 0.7% от оборота сделки. Это привязывает оплату к фактически проведённой операции, а не к декоративной подписке.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Cell title='Сделка 4.2 млн ₽' value='29 400 ₽' note='Ориентир по одной средней сделке' />
          <Cell title='Сделка 10 млн ₽' value='70 000 ₽' note='Ориентир для крупного покупателя' />
          <Cell title='100 млн ₽ GMV' value='700 000 ₽' note='Ориентир месячной выручки при масштабе' />
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 800, color: '#0F1419' }}>Монетизация внутри платформы</div>
          <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8 }}>
            Не только тарифы, но и точки, через которые пользователю уже виден денежный и доверительный слой платформы.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {MONETIZATION_MODULES.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'grid', gap: 8, padding: 16, borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{item.note}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>Открыть →</div>
            </Link>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/investor' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Инвесторский режим
        </Link>
        <Link href='/platform-v7/about' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          О проекте
        </Link>
      </div>
    </div>
  );
}

function Cell({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div style={{ border: '1px solid #E4E6EA', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ fontSize: 12, color: '#6B778C', fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 900, color: '#0F1419' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#6B778C', lineHeight: 1.55 }}>{note}</div>
    </div>
  );
}
