import Link from 'next/link';
import { P7DealWorkspaceTabs } from '@/components/platform-v7/P7DealWorkspaceTabs';
import { canonicalDomainDeals, selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { moneyStopReasonText } from '@/lib/platform-v7/domain/money-stop-labels';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#475569';
const green = '#0A7A5F';
const red = '#B91C1C';
const redBg = 'rgba(220,38,38,0.08)';
const greenBg = 'rgba(10,122,95,0.08)';

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

export default function PlatformV7CleanDealPage({ params }: { params: { id: string } }) {
  const deal = selectDealById(params.id);

  if (!deal) {
    return (
      <main style={{ display: 'grid', gap: 16 }}>
        <section style={card()}>
          <p style={{ margin: 0, color: red, fontWeight: 900 }}>Сделка не найдена</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 28, color: text }}>{params.id}</h1>
          <p style={{ color: muted }}>В доменном контуре нет такой сделки. Возврат к списку не меняет данные.</p>
          <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        </section>
      </main>
    );
  }

  const canonicalDeal = canonicalDomainDeals.find((item) => item.id === deal.id);
  const releaseCheck = canonicalDeal ? evaluateReleaseGuard(canonicalDeal) : null;
  const releaseAmountRaw = releaseCheck?.releaseAmount ?? deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const releaseAmount = releaseCheck && !releaseCheck.canRequestRelease ? 0 : releaseAmountRaw;
  const disputes = selectDisputesByDealId(deal.id);
  const releaseReasons = releaseCheck?.blockers ?? [];
  const hasBlockers = releaseReasons.length > 0 || deal.blockers.length > 0 || deal.holdAmount > 0 || disputes.length > 0;

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, color: muted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Карточка сделки · пилотный контур</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 28, color: text }}>{deal.id}</h1>
            <p style={{ margin: '8px 0 0', color: muted, lineHeight: 1.55 }}>Цена, логистика, документы, деньги, спор и доказательства собраны в одном рабочем контуре.</p>
          </div>
          <span style={{ borderRadius: 999, padding: '6px 10px', background: hasBlockers ? redBg : greenBg, color: hasBlockers ? red : green, fontSize: 12, fontWeight: 900 }}>
            {hasBlockers ? 'деньги остановлены' : 'критичных блокеров нет'}
          </span>
        </div>
      </section>

      <section style={grid()}>
        <Cell label='Культура' value={deal.grain} />
        <Cell label='Объём' value={`${deal.quantity} ${deal.unit}`} />
        <Cell label='Продавец' value={deal.seller.name} />
        <Cell label='Покупатель' value={deal.buyer.name} />
      </section>

      <section style={grid()}>
        <Cell label='Резерв денег' value={rub(deal.reservedAmount)} accent />
        <Cell label='Удержание' value={rub(deal.holdAmount)} danger={deal.holdAmount > 0} />
        <Cell label='К выпуску' value={rub(releaseAmount)} accent={!hasBlockers} muted={hasBlockers} />
        <Cell label='Открытые споры' value={String(disputes.length)} danger={disputes.length > 0} />
      </section>

      {hasBlockers ? (
        <section style={{ ...card(), background: redBg, borderColor: 'rgba(220,38,38,0.18)' }}>
          <p style={{ margin: 0, color: red, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Что блокирует выпуск денег</p>
          <p style={{ margin: '8px 0 0', color: text, lineHeight: 1.55 }}>
            {releaseReasons.length > 0 ? moneyStopReasonText(releaseReasons) : deal.blockers.length > 0 ? deal.blockers.join(' · ') : 'Нет технических блокеров'}{disputes.length > 0 && !releaseReasons.includes('OPEN_DISPUTE') ? ` · спор ${disputes[0]?.id}` : ''}
          </p>
        </section>
      ) : null}

      <P7DealWorkspaceTabs deal={deal} />

      <section style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/deals' style={linkStyle()}>Все сделки</Link>
        <Link href='/platform-v7/bank/release-safety' style={linkStyle()}>Проверка денег</Link>
        <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkStyle()}>Документы сделки</Link>
        <Link href='/platform-v7/disputes' style={linkStyle('danger')}>Споры</Link>
      </section>
    </main>
  );
}

function Cell({ label, value, accent = false, danger = false, muted: isMuted = false }: { label: string; value: string; accent?: boolean; danger?: boolean; muted?: boolean }) {
  return (
    <div style={card()}>
      <p style={{ margin: 0, color: muted, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ margin: '6px 0 0', color: danger ? red : accent ? green : isMuted ? muted : text, fontSize: 17, fontWeight: 900 }}>{value}</p>
    </div>
  );
}

function card(): React.CSSProperties {
  return { background: '#fff', border: `1px solid ${border}`, borderRadius: 18, padding: 20 };
}

function grid(): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 };
}

function linkStyle(tone: 'default' | 'danger' = 'default'): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: tone === 'danger' ? red : green, border: `1px solid ${tone === 'danger' ? 'rgba(220,38,38,0.18)' : border}`, borderRadius: 12, padding: '10px 14px', fontWeight: 900, background: '#fff' };
}
