import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';
import { executionContourFixtures, getVisibleBidsForRole, type Bid, type Lot } from '@/lib/platform-v7/execution-contour';

const lot = executionContourFixtures.lots[0];
const buyerBid = getVisibleBidsForRole({ role: 'buyer', lot, bids: executionContourFixtures.bids, viewerCounterpartyId: 'cp-buyer-2' })[0];

function rub(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

const card = {
  border: '1px solid #E4E6EA',
  borderRadius: 20,
  background: '#FFFFFF',
  padding: 18,
  display: 'grid',
  gap: 12,
} as const;

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
} as const;

const muted = { color: '#667085', fontSize: 13, lineHeight: 1.55 } as const;

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <div style={muted}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#101828' }}>{value}</div>
    </div>
  );
}

function BuyerLotCard({ item }: { readonly item: Lot }) {
  const bidCount = executionContourFixtures.bids.filter((bid) => bid.lotId === item.lotId).length;
  return (
    <article style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{item.crop} · {item.grade} · {item.volumeTons} т</h2>
          <div style={muted}>{item.region} · {item.basis}</div>
        </div>
        <span style={{ border: '1px solid #D0D5DD', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 800 }}>идут ставки</span>
      </div>
      <div style={grid}>
        <Metric label="Ожидаемая цена" value={`${rub(item.targetPricePerTon)}/т`} />
        <Metric label="Объём" value={`${item.volumeTons} т`} />
        <Metric label="Ставок" value={String(bidCount)} />
        <Metric label="Документы" value={`${item.documentsReadiness}%`} />
      </div>
      <div style={muted}>ФГИС/СДИЗ: требуется проверка · окно вывоза: 02.05.2026 08:00–14:00.</div>
      <a href="/platform-v7/lots" style={{ minHeight: 44, width: 'fit-content', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: '#0A7A5F', color: '#FFFFFF', padding: '0 14px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>Сделать ставку</a>
    </article>
  );
}

function BuyerBidCard({ bid }: { readonly bid: Bid }) {
  return (
    <article style={card}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Ваша ставка</h2>
      <div style={grid}>
        <Metric label="Цена" value={`${rub(bid.pricePerTon)}/т`} />
        <Metric label="Объём" value={`${bid.volumeTons} т`} />
        <Metric label="Сумма" value={rub(bid.totalAmount)} />
        <Metric label="Статус" value="активна" />
      </div>
      <div style={muted}>Позиция: есть более сильное предложение. В закрытом режиме покупатель не видит чужие ставки и данные продавца сверх условий лота.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href="/platform-v7/buyer" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, border: '1px solid #D0D5DD', color: '#101828', padding: '0 14px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>Повысить</a>
        <a href="/platform-v7/buyer" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, border: '1px solid #D0D5DD', color: '#101828', padding: '0 14px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>Изменить</a>
        <a href="/platform-v7/buyer" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, border: '1px solid #D0D5DD', color: '#101828', padding: '0 14px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>Отозвать</a>
      </div>
    </article>
  );
}

export function BuyerLotSearchScreen() {
  return (
    <P7Page title="Покупатель: доступные лоты" subtitle="Покупатель видит условия лота, отправляет ставку и контролирует только собственное предложение в закрытом режиме." testId="platform-v7-buyer-lots-safe">
      <P7Section title="Поиск лота" subtitle="Культура · класс · регион · объём · цена · базис · документы · срок вывоза · ФГИС/СДИЗ · логистика.">
        <BuyerLotCard item={lot} />
      </P7Section>
      <P7Section title="Статус вашей ставки" subtitle="После отправки ставки доступны действия: повысить, изменить или отозвать.">
        {buyerBid ? <BuyerBidCard bid={buyerBid} /> : null}
      </P7Section>
    </P7Page>
  );
}
