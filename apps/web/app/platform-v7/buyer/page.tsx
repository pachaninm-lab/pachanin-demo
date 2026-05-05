import Link from 'next/link';

const lots = [
  {
    id: 'LOT-2405',
    crop: 'Пшеница 4 класса',
    volume: '240 т',
    region: 'Тамбовская область',
    price: '16 120 ₽/т',
    sellerScore: '92/100',
    docs: 'ФГИС подтверждён · документы на проверке',
    action: 'Повысить ставку или ждать окончания',
    status: 'Лучшая ставка перебивает рынок',
    href: '/platform-v7/lots/LOT-2405',
  },
  {
    id: 'LOT-2403',
    crop: 'Пшеница 4 класса',
    volume: '600 т',
    region: 'Тамбовская область',
    price: '16 080 ₽/т',
    sellerScore: '89/100',
    docs: 'партия подтверждена · СДИЗ не оформлен',
    action: 'Подтвердить резерв денег',
    status: 'Ставка принята',
    href: '/platform-v7/lots/LOT-2403',
  },
] as const;

const deals = [
  { id: 'DL-9106', lot: 'LOT-2403', status: 'ожидает резерв', reserve: '9,65 млн ₽', hold: '0 ₽', next: 'подтвердить резерв денег', href: '/platform-v7/deals/DL-9106/clean' },
  { id: 'DL-9102', lot: 'LOT-2402', status: 'спор по весу', reserve: '6,24 млн ₽', hold: '624 тыс. ₽', next: 'закрыть отклонение веса', href: '/platform-v7/deals/DL-9102' },
] as const;

const creditSteps = [
  { label: 'Сбер · Оплата в кредит', value: 'лимит покупателя', state: 'ok' },
  { label: 'Заявка', value: 'предодобрена в тестовом сценарии', state: 'ok' },
  { label: 'Доступно к резерву', value: '9,65 млн ₽', state: 'wait' },
  { label: 'Продавец', value: 'не получает кредитную линию', state: 'manual' },
] as const;

const buyerSummary = [
  { label: 'Что сейчас', value: 'LOT-2403 → ставка принята → DL-9106', note: 'Покупатель выиграл объём, но сделка ещё ждёт резерв денег.' },
  { label: 'Моя ставка', value: '16 080 ₽/т · 600 т', note: 'Чужие закрытые ставки не раскрываются. Видна только собственная ставка и допустимый статус рынка.' },
  { label: 'Где деньги', value: 'резерв 9,65 млн ₽ · к подтверждению', note: 'Сбер · Оплата в кредит относится только к покупателю. Продавец видит не кредит, а готовность резерва.' },
  { label: 'Где груз', value: 'LOG-REQ-2403 / TRIP-SIM-001', note: 'После резерва сделка идёт в логистику, рейс и приёмку.' },
  { label: 'Где документы', value: 'СДИЗ не оформлен · ЭТрН ждёт подписи', note: 'Без документов, приёмки и качества выпуск денег продавцу закрыт.' },
  { label: 'Что делать дальше', value: 'подтвердить резерв денег', note: 'Следующий шаг покупателя должен оставить след в сделке и банковом контуре.' },
] as const;

const buyerGrainEntries = [
  {
    title: 'Создать закупочный запрос',
    note: 'Зафиксировать культуру, объём, регион, базис, цену и требования к документам.',
    href: '/platform-v7/buyer/rfq/create',
  },
  {
    title: 'Подбор партии',
    note: 'Сопоставить потребность с партиями, документами, логистикой и риском исполнения.',
    href: '/platform-v7/buyer/rfq',
  },
  {
    title: 'Карточка запроса',
    note: 'Проверить цену до точки, риск продавца, документы, следующий шаг и готовность сделки.',
    href: '/platform-v7/buyer/rfq/detail',
  },
  {
    title: 'Резерв и сделка',
    note: 'Подтвердить резерв денег и увидеть, что блокирует дальнейшее исполнение.',
    href: '/platform-v7/deals/DL-9106/clean',
  },
] as const;

export default function PlatformV7BuyerPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={card}>
        <div style={badge}>Кабинет покупателя</div>
        <h1 style={h1}>Закупочные запросы, партии, резерв и кредит Сбера</h1>
        <p style={lead}>Покупатель видит доступные партии, свой закупочный запрос, собственную ставку, готовность документов, резерв денег и кредитный лимит. Чужие ставки раскрываются только в допустимом обезличенном виде.</p>
        <div style={actions}>
          <Link href='/platform-v7/buyer/rfq/create' style={primaryBtn}>Создать закупочный запрос</Link>
          <Link href='/platform-v7/buyer/rfq' style={ghostBtn}>Подбор партий</Link>
          <Link href='/platform-v7/deals/DL-9106/clean' style={ghostBtn}>Открыть Deal 360</Link>
          <Link href='/platform-v7/buyer/financing' style={ghostBtn}>Сбер · Оплата в кредит</Link>
          <Link href='/platform-v7/bank' style={ghostBtn}>Резерв денег</Link>
        </div>
      </section>

      <section style={card}>
        <div style={micro}>Зерновой контур покупателя</div>
        <h2 style={{ margin: 0, color: '#0F1419', fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.035em', fontWeight: 950 }}>От потребности до сделки</h2>
        <p style={{ margin: 0, color: '#64748B', fontSize: 14, lineHeight: 1.55 }}>Покупателю нужен короткий путь: задать потребность, увидеть подходящую партию, проверить цену до точки, риск документов, рейтинг продавца и готовность резерва.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {buyerGrainEntries.map((entry) => (
            <Link key={entry.href} href={entry.href} style={buyerEntryCard}>
              <span style={{ width: 42, height: 4, borderRadius: 999, background: '#2563EB' }} />
              <strong style={{ color: '#0F1419', fontSize: 17, lineHeight: 1.2 }}>{entry.title}</strong>
              <span style={{ color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>{entry.note}</span>
              <span style={{ marginTop: 'auto', color: '#2563EB', fontSize: 12, fontWeight: 900 }}>Открыть</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={buyerControlCard}>
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ ...micro, color: '#BFDBFE' }}>контроль покупки по DL-9106</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(24px,6vw,36px)', lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950 }}>Что покупатель должен понять за 5 секунд</h2>
          <p style={{ margin: 0, color: '#DBEAFE', fontSize: 14, lineHeight: 1.55 }}>Экран отделяет ставку от сделки, резерв от выплаты продавцу, кредитный лимит покупателя от видимости продавца и закрытые ставки от допустимого обзора рынка.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {buyerSummary.map((item) => <SummaryCard key={item.label} item={item} />)}
        </div>
      </section>

      <section style={metricsGrid}>
        <Metric label='В резерве' value='15,89 млн ₽' />
        <Metric label='К подтверждению' value='9,65 млн ₽' good />
        <Metric label='Под удержанием' value='624 тыс. ₽' danger />
        <Metric label='Активных ставок' value='2' />
      </section>

      <section style={card}>
        <div style={micro}>Кредитный лимит покупателя</div>
        <div style={grid2}>
          {creditSteps.map((item) => <CreditCell key={item.label} item={item} />)}
        </div>
        <div style={creditNotice}>Сбер · Оплата в кредит — сценарий покупателя. Это не кредитная линия продавца. Для продавца это влияет только на готовность покупателя зарезервировать деньги по сделке.</div>
      </section>

      <section style={card}>
        <div style={micro}>Лоты для покупки</div>
        {lots.map((lot) => (
          <Link key={lot.id} href={lot.href} style={rowLink}>
            <div style={rowHead}>
              <div>
                <div style={idText}>{lot.id}</div>
                <h2 style={h2}>{lot.crop} · {lot.volume}</h2>
                <p style={muted}>{lot.region} · {lot.docs}</p>
              </div>
              <span style={statusPill}>{lot.status}</span>
            </div>
            <div style={grid2}>
              <Cell label='Цена' value={lot.price} strong />
              <Cell label='Рейтинг продавца' value={lot.sellerScore} />
              <Cell label='Следующее действие' value={lot.action} />
              <Cell label='Видимость ставок' value='чужие закрытые ставки скрыты' />
            </div>
          </Link>
        ))}
      </section>

      <section style={card}>
        <div style={micro}>Мои сделки</div>
        {deals.map((deal) => (
          <Link key={deal.id} href={deal.href} style={rowLink}>
            <div style={rowHead}>
              <div>
                <div style={idText}>{deal.id} · {deal.lot}</div>
                <h2 style={h2}>{deal.status}</h2>
              </div>
              <span style={deal.hold !== '0 ₽' ? dangerPill : statusPill}>{deal.hold !== '0 ₽' ? 'есть удержание' : 'без удержания'}</span>
            </div>
            <div style={grid2}>
              <Cell label='Резерв' value={deal.reserve} strong />
              <Cell label='Удержано' value={deal.hold} danger={deal.hold !== '0 ₽'} />
              <Cell label='Следующее действие' value={deal.next} />
              <Cell label='Открыть' value='карточка сделки' />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}

function SummaryCard({ item }: { item: typeof buyerSummary[number] }) {
  return <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 18, padding: 13, display: 'grid', gap: 7 }}><div style={{ ...micro, color: '#BFDBFE' }}>{item.label}</div><strong style={{ color: '#fff', fontSize: 14, lineHeight: 1.4 }}>{item.value}</strong><p style={{ margin: 0, color: '#DBEAFE', fontSize: 12, lineHeight: 1.45 }}>{item.note}</p></div>;
}

function Metric({ label, value, good = false, danger = false }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 16 }}><div style={micro}>{label}</div><div style={{ marginTop: 8, color: danger ? '#B91C1C' : good ? '#0A7A5F' : '#0F1419', fontSize: 28, lineHeight: 1, fontWeight: 950 }}>{value}</div></div>;
}

function Cell({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return <div style={cell}><div style={micro}>{label}</div><div style={{ marginTop: 4, color: danger ? '#B91C1C' : strong ? '#0A7A5F' : '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{value}</div></div>;
}

function CreditCell({ item }: { item: typeof creditSteps[number] }) {
  const color = item.state === 'ok' ? '#0A7A5F' : item.state === 'wait' ? '#B45309' : '#64748B';
  const bg = item.state === 'ok' ? 'rgba(10,122,95,0.06)' : item.state === 'wait' ? 'rgba(217,119,6,0.06)' : '#F8FAFB';
  const border = item.state === 'ok' ? 'rgba(10,122,95,0.18)' : item.state === 'wait' ? 'rgba(217,119,6,0.18)' : '#E4E6EA';
  return <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 13, padding: 10 }}><div style={{ ...micro, color }}>{item.label}</div><div style={{ marginTop: 4, color: '#0F1419', fontSize: 13, lineHeight: 1.25, fontWeight: 900 }}>{item.value}</div></div>;
}

const card = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 } as const;
const buyerControlCard = { background: '#1D4ED8', border: '1px solid rgba(37,99,235,0.35)', borderRadius: 24, padding: 18, display: 'grid', gap: 13, boxShadow: '0 18px 44px rgba(37,99,235,0.18)' } as const;
const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 12, fontWeight: 900 } as const;
const h1 = { margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 } as const;
const h2 = { margin: '6px 0 0', color: '#0F1419', fontSize: 22, lineHeight: 1.08, fontWeight: 950 } as const;
const lead = { margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 } as const;
const muted = { margin: '6px 0 0', color: '#64748B', fontSize: 13 } as const;
const actions = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#2563EB', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const metricsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 } as const;
const rowLink = { textDecoration: 'none', color: 'inherit', background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 20, padding: 15, display: 'grid', gap: 12 } as const;
const rowHead = { display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' } as const;
const idText = { color: '#2563EB', fontSize: 13, fontWeight: 950 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 8 } as const;
const cell = { background: '#fff', border: '1px solid #E4E6EA', borderRadius: 13, padding: 10, minWidth: 0 } as const;
const buyerEntryCard = { textDecoration: 'none', minHeight: 156, display: 'grid', gap: 9, padding: 14, borderRadius: 18, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#0F1419' } as const;
const statusPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const dangerPill = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C', fontSize: 12, fontWeight: 900 } as const;
const creditNotice = { background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.16)', color: '#1D4ED8', borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 900, lineHeight: 1.45 } as const;
