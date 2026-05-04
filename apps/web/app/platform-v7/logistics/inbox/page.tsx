const inboxSummary = [
  { label: 'Что пришло', value: 'LOG-REQ-2403 по DL-9106', note: 'Заявка появилась после выбора победителя и создания сделки.' },
  { label: 'Что везём', value: 'Пшеница 4 кл. · 600 т', note: 'Логист видит груз, маршрут, окна и требования к рейсу.' },
  { label: 'Где груз', value: 'склад продавца → Элеватор ВРЖ-08', note: 'Создаётся рейс TRIP-SIM-001 с ближайшим доступным водителем.' },
  { label: 'Что скрыто', value: 'ставки, цена зерна, банк, резерв, кредит', note: 'Логист не видит коммерческие и банковские данные сторон.' },
  { label: 'Документы', value: 'ЭТрН → ГИС ЭПД → СДИЗ', note: 'ЭТрН нужна для рейса, ГИС ЭПД — после подписи, СДИЗ влияет на деньги.' },
  { label: 'Следующий шаг', value: 'назначить водителя и создать рейс', note: 'Действие должно оставить след в журнале сделки.' },
] as const;

const assignmentChecks = [
  { label: 'Водитель', value: 'Водитель А · 12 км до точки погрузки' },
  { label: 'Машина', value: 'Р***ТУ · допуск к зерновому рейсу' },
  { label: 'ETA', value: 'прибытие через 18 минут' },
  { label: 'Рейс', value: 'TRIP-SIM-001 · controlled-pilot' },
] as const;

export default function LogisticsInboxPage() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 20, display: 'grid', gap: 10 }}>
        <p style={microGreen}>Логистика · входящие заявки</p>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,7vw,50px)', lineHeight: 1.04, letterSpacing: '-0.045em' }}>Заявка появляется после выбора победителя</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 }}>Логистическая компания принимает заказ по сделке, выбирает ближайшего доступного водителя и создаёт рейс. Показан controlled-pilot сценарий без боевого GPS и внешних API.</p>
      </section>

      <section style={{ background: '#0F172A', color: '#fff', borderRadius: 24, padding: 18, display: 'grid', gap: 13 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <p style={{ ...micro, margin: 0, color: '#A7F3D0' }}>контроль заявки</p>
          <h2 style={{ margin: 0, fontSize: 'clamp(24px,6vw,36px)', lineHeight: 1.08, letterSpacing: '-0.04em' }}>Что логист должен понять за 5 секунд</h2>
          <p style={{ margin: 0, color: '#CBD5E1', fontSize: 14, lineHeight: 1.55 }}>Экран показывает только исполнение перевозки. Ставки, цену зерна, банк, резерв и кредит логистика не видит.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {inboxSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <article style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 10 }}>
          <p style={micro}>Заявка</p>
          <h2 style={{ margin: 0, color: '#0F1419', fontSize: 26 }}>LOG-REQ-2403</h2>
          <p style={muted}>LOT-2403 → DL-9106</p>
          <p style={muted}>Пшеница 4 кл. · 600 т</p>
          <p style={muted}>Склад продавца → Элеватор ВРЖ-08</p>
          <div style={notice}>Коммерческие ставки, цена зерна, резерв денег и кредит покупателя скрыты для логистики.</div>
        </article>

        <article style={{ background: '#0F1419', color: '#fff', borderRadius: 22, padding: 18, display: 'grid', gap: 10 }}>
          <p style={{ ...micro, margin: 0, color: '#B6C2CF' }}>Назначение</p>
          <h2 style={{ margin: 0, fontSize: 26 }}>Ближайший водитель выбран</h2>
          <p style={{ margin: 0, color: '#D8DEE6' }}>Расстояние 12 км · прибытие через 18 минут</p>
          <p style={{ margin: 0, color: '#D8DEE6' }}>Создан рейс TRIP-SIM-001</p>
          <a href="/platform-v7/driver" style={{ color: '#fff', textDecoration: 'none', borderRadius: 14, background: '#0A7A5F', padding: '12px 14px', textAlign: 'center', fontWeight: 900 }}>Открыть рейс водителя</a>
        </article>
      </section>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 22, padding: 18, display: 'grid', gap: 10 }}>
        <p style={micro}>Проверка перед назначением</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8 }}>
          {assignmentChecks.map((item) => <CheckCell key={item.label} item={item} />)}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ item }: { item: typeof inboxSummary[number] }) {
  return <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 18, padding: 13, display: 'grid', gap: 7 }}><div style={{ ...micro, color: '#A7F3D0' }}>{item.label}</div><strong style={{ color: '#fff', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#CBD5E1', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function CheckCell({ item }: { item: typeof assignmentChecks[number] }) {
  return <div style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10 }}><div style={micro}>{item.label}</div><div style={{ marginTop: 4, color: '#0F1419', fontSize: 13, lineHeight: 1.35, fontWeight: 900 }}>{item.value}</div></div>;
}

const micro = { color: '#64748B', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const microGreen = { margin: 0, color: '#0A7A5F', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } as const;
const muted = { margin: 0, color: '#475569' } as const;
const notice = { background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.16)', color: '#0A7A5F', borderRadius: 14, padding: 11, fontSize: 13, fontWeight: 900, lineHeight: 1.45 } as const;
