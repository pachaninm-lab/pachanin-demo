import Link from 'next/link';

const lots = [
  {
    id: 'LOT-2403',
    title: 'Пшеница 4 класса',
    volume: '600 т',
    basis: 'Тамбовская область · EXW',
    state: 'Победитель выбран',
    ends: 'торги завершены',
    payout: 'выплата остановлена до закрытия документов',
    money: ['Резерв: 9,65 млн ₽', 'К выплате сейчас: 0 ₽', 'СДИЗ: не подтверждён', 'ЭТрН: ждёт подписи'],
    chain: ['Победитель: Покупатель 1', 'Сделка DL-9106', 'Резерв 9,65 млн ₽', 'Логистика LOG-REQ-2403', 'Рейс TRIP-SIM-001'],
    bids: [
      { buyer: 'Покупатель 1', region: 'Воронежская область', rating: 91, price: '16 080 ₽/т', volume: '600 т', money: 'готов к резерву', time: 'принята 2 мин назад', status: 'Принята' },
      { buyer: 'Покупатель 2', region: 'Краснодарский край', rating: 82, price: '15 970 ₽/т', volume: '1 000 т', money: 'нужна проверка', time: '4 мин назад', status: 'Активна' },
      { buyer: 'Покупатель 3', region: 'Липецкая область', rating: 96, price: '15 850 ₽/т', volume: '500 т', money: 'готов к резерву', time: '6 мин назад', status: 'Активна' },
    ],
  },
  {
    id: 'LOT-2405',
    title: 'Пшеница 4 класса',
    volume: '240 т',
    basis: 'Тамбовская область · EXW',
    state: 'Идут ставки',
    ends: 'осталось 01:18:42',
    payout: 'деньги появятся после выбора победителя и резерва',
    money: ['Лучшая ставка: 16 120 ₽/т', 'Резерв: готовность покупателя', 'Сделка: ещё не создана', 'Выплата: недоступна'],
    chain: ['Ожидает выбора победителя', 'После принятия: сделка → резерв → логистика → рейс'],
    bids: [
      { buyer: 'Покупатель 4', region: 'Воронежская область', rating: 94, price: '16 120 ₽/т', volume: '240 т', money: 'резерв готов', time: '12 сек назад', status: 'Лучшая ставка' },
      { buyer: 'Покупатель 2', region: 'Краснодарский край', rating: 82, price: '16 040 ₽/т', volume: '240 т', money: 'нужна проверка', time: '38 сек назад', status: 'Активна' },
      { buyer: 'Покупатель 5', region: 'Липецкая область', rating: 88, price: '15 990 ₽/т', volume: '180 т', money: 'резерв готов', time: '1 мин назад', status: 'Активна' },
    ],
  },
] as const;

export default function PlatformV7SellerPage() {
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 10 }}>
        <div style={badge}>Кабинет продавца</div>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>Лоты, ставки и когда будут деньги</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 }}>Продавец видит лоты, обезличенные ставки, числовой рейтинг покупателей, победителя, резерв и условия выплаты. Деньги не показываются как доступные, пока не закрыты СДИЗ, ЭТрН, приёмка и документы.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/lots/create' style={primaryBtn}>Создать лот</Link>
          <Link href='/platform-v7/documents' style={ghostBtn}>Документы</Link>
        </div>
      </section>

      {lots.map((lot) => (
        <section key={lot.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 14, boxShadow: '0 12px 28px rgba(15,20,25,0.045)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={micro}>Лот</div>
              <Link href={`/platform-v7/lots/${lot.id}`} style={{ color: '#0F1419', textDecoration: 'none' }}>
                <h2 style={{ margin: 0, fontSize: 28, lineHeight: 1.08, fontWeight: 950 }}>{lot.id} · {lot.title}</h2>
              </Link>
              <p style={{ margin: 0, color: '#64748B', fontSize: 13 }}>{lot.volume} · {lot.basis}</p>
            </div>
            <div style={{ display: 'grid', gap: 7, justifyItems: 'end' }}>
              <span style={status}>{lot.state}</span>
              <span style={timer}>{lot.ends}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {lot.bids.map((bid) => <BidRow key={`${lot.id}-${bid.buyer}`} bid={bid} />)}
          </div>

          <div style={{ background: lot.id === 'LOT-2403' ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)', border: `1px solid ${lot.id === 'LOT-2403' ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)'}`, borderRadius: 18, padding: 14, display: 'grid', gap: 10 }}>
            <div style={{ ...micro, color: lot.id === 'LOT-2403' ? '#B91C1C' : '#B45309' }}>Когда продавец получает деньги</div>
            <strong style={{ color: '#0F1419', fontSize: 16 }}>{lot.payout}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
              {lot.money.map((item) => <Mini key={item} value={item} />)}
            </div>
          </div>

          <div style={{ background: '#0F172A', color: '#fff', borderRadius: 18, padding: 14, display: 'grid', gap: 8 }}>
            <div style={{ ...micro, color: '#A7F3D0' }}>Дальнейшая цепочка</div>
            <div style={{ display: 'grid', gap: 7 }}>
              {lot.chain.map((item, index) => (
                <div key={item} style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 999, background: index === 0 ? '#0A7A5F' : 'rgba(255,255,255,0.14)', display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{index + 1}</span>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}

function BidRow({ bid }: { bid: typeof lots[number]['bids'][number] }) {
  const isBest = bid.status === 'Принята' || bid.status === 'Лучшая ставка';
  return (
    <article style={{ border: `1px solid ${isBest ? 'rgba(10,122,95,0.25)' : '#E4E6EA'}`, background: isBest ? 'rgba(10,122,95,0.06)' : '#F8FAFB', borderRadius: 18, padding: 13, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#0F1419', fontSize: 16, fontWeight: 950 }}>{bid.buyer}</div>
          <div style={{ marginTop: 3, color: '#64748B', fontSize: 12 }}>{bid.region} · {bid.time}</div>
        </div>
        <span style={isBest ? status : neutralStatus}>{bid.status}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(92px,1fr))', gap: 8 }}>
        <Cell label='Рейтинг' value={`${bid.rating}/100`} strong={bid.rating >= 90} />
        <Cell label='Цена' value={bid.price} strong={isBest} />
        <Cell label='Объём' value={bid.volume} />
        <Cell label='Деньги' value={bid.money} />
      </div>
    </article>
  );
}

function Cell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10 }}><div style={micro}>{label}</div><div style={{ marginTop: 3, color: strong ? '#0A7A5F' : '#0F1419', fontSize: 13, fontWeight: 900 }}>{value}</div></div>;
}
function Mini({ value }: { value: string }) {
  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, color: '#0F1419', fontSize: 13, fontWeight: 900 }}>{value}</div>;
}

const badge = { display: 'inline-flex', width: 'fit-content', padding: '7px 11px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const micro = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.07em' } as const;
const primaryBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#0A7A5F', color: '#fff', fontSize: 14, fontWeight: 900 } as const;
const ghostBtn = { textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 14, background: '#fff', border: '1px solid #CBD5E1', color: '#0F1419', fontSize: 14, fontWeight: 850 } as const;
const status = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 12, fontWeight: 900 } as const;
const neutralStatus = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: '#fff', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 900 } as const;
const timer = { display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.22)', color: '#B45309', fontSize: 12, fontWeight: 900 } as const;
