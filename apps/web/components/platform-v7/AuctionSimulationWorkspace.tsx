'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LotBiddingSimulation, LotBid } from '@/lib/platform-v7/domain/lot-bidding-simulation';
import { selectWinningLotBid } from '@/lib/platform-v7/domain/lot-bidding-simulation';

type SimRole = 'seller' | 'buyer1' | 'buyer2' | 'operator';
type AuctionMode = 'open' | 'closed' | 'fixed' | 'negotiation';
type RuntimeBid = LotBid & { withdrawn?: boolean; isRuntime?: boolean };
type JournalItem = { time: string; actor: string; text: string };

const roleLabels: Record<SimRole, string> = {
  seller: 'Продавец',
  buyer1: 'Покупатель 1',
  buyer2: 'Покупатель 2',
  operator: 'Оператор',
};

const buyerNames: Record<Extract<SimRole, 'buyer1' | 'buyer2'>, string> = {
  buyer1: 'АО «АгроТрейд»',
  buyer2: 'ООО «ЗерноИнвест»',
};

const modeLabels: Record<AuctionMode, string> = {
  open: 'Открытые торги',
  closed: 'Закрытые торги',
  fixed: 'Фиксированная цена',
  negotiation: 'Переговоры',
};

function rub(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
}

function statusText(status: RuntimeBid['status'], withdrawn?: boolean) {
  if (withdrawn) return 'отозвана';
  if (status === 'winner') return 'победитель';
  if (status === 'leader') return 'лидер';
  if (status === 'outbid') return 'перебита';
  return 'заблокирована';
}

function statusTone(status: RuntimeBid['status'], withdrawn?: boolean) {
  if (withdrawn) return 'neutral';
  if (status === 'winner' || status === 'leader') return 'green';
  if (status === 'blocked') return 'red';
  return 'amber';
}

function rankBids(bids: RuntimeBid[]) {
  const active = bids.filter((bid) => !bid.withdrawn && bid.status !== 'blocked');
  const ranked = [...active].sort((a, b) => b.pricePerTon - a.pricePerTon || b.score - a.score);
  const leaderId = ranked[0]?.id;
  return bids.map((bid) => {
    if (bid.withdrawn || bid.status === 'blocked' || bid.status === 'winner') return bid;
    return { ...bid, status: bid.id === leaderId ? 'leader' : 'outbid' } as RuntimeBid;
  });
}

function visibleBidLabel(bid: RuntimeBid, role: SimRole, mode: AuctionMode) {
  const isBuyer = role === 'buyer1' || role === 'buyer2';
  const own = isBuyer && bid.buyer === buyerNames[role];
  if (mode === 'closed' && isBuyer && !own) return 'Скрытая ставка конкурента';
  return bid.buyer;
}

function visiblePrice(bid: RuntimeBid, role: SimRole, mode: AuctionMode) {
  const isBuyer = role === 'buyer1' || role === 'buyer2';
  const own = isBuyer && bid.buyer === buyerNames[role];
  if (mode === 'closed' && isBuyer && !own) return 'скрыто';
  return `${rub(bid.pricePerTon)} / т`;
}

export function AuctionSimulationWorkspace({ simulation }: { simulation: LotBiddingSimulation }) {
  const router = useRouter();
  const staticWinner = selectWinningLotBid(simulation);
  const [role, setRole] = React.useState<SimRole>('seller');
  const [mode, setMode] = React.useState<AuctionMode>('open');
  const [secondsLeft, setSecondsLeft] = React.useState(9 * 60 + 30);
  const [selectedBidId, setSelectedBidId] = React.useState<string | null>(simulation.winnerBidId);
  const [dealCreated, setDealCreated] = React.useState(Boolean(simulation.resultingDealId));
  const [bids, setBids] = React.useState<RuntimeBid[]>(() => rankBids(simulation.bids.map((bid) => ({ ...bid }))));
  const [journal, setJournal] = React.useState<JournalItem[]>(() => [
    ...simulation.auditTrail.map((item) => ({ time: item.time, actor: item.actor, text: `${item.action}: ${item.result}` })),
  ]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const closedByTimer = secondsLeft === 0;
  const blockedByGate = simulation.gateState !== 'PASS';
  const activeBids = bids.filter((bid) => !bid.withdrawn && bid.status !== 'blocked');
  const leader = [...activeBids].sort((a, b) => b.pricePerTon - a.pricePerTon || b.score - a.score)[0] ?? null;
  const selectedBid = bids.find((bid) => bid.id === selectedBidId) ?? staticWinner;
  const buyerOwnBid = role === 'buyer1' || role === 'buyer2' ? bids.find((bid) => bid.buyer === buyerNames[role]) : null;
  const canBid = !blockedByGate && !closedByTimer && !dealCreated && (role === 'buyer1' || role === 'buyer2') && mode !== 'fixed';
  const canSelectWinner = !blockedByGate && !dealCreated && (role === 'seller' || role === 'operator') && Boolean(leader);
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  function addJournal(actor: string, text: string) {
    const now = new Date();
    setJournal((items) => [{ time: now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), actor, text }, ...items]);
  }

  function placeBid() {
    if (!canBid) return;
    const buyer = buyerNames[role as 'buyer1' | 'buyer2'];
    const nextPrice = Math.max((leader?.pricePerTon ?? simulation.bestPricePerTon ?? 0) + 150, simulation.bestPricePerTon ?? 0);
    const existing = bids.find((bid) => bid.buyer === buyer);
    const nextBids = existing
      ? bids.map((bid) => bid.id === existing.id ? { ...bid, pricePerTon: nextPrice, submittedAt: 'сейчас', withdrawn: false, isRuntime: true } : bid)
      : [{
          id: `${simulation.lot.id}-BID-RUNTIME-${role}`,
          buyerId: role.toUpperCase(),
          buyer,
          pricePerTon: nextPrice,
          volumeTons: simulation.lot.volumeTons,
          payment: 'резерв денег через банк',
          logistics: 'платформенная логистика',
          submittedAt: 'сейчас',
          score: 90,
          status: 'leader' as const,
          nextStep: 'Ждёт выбора продавцом',
          isRuntime: true,
        }, ...bids];
    setBids(rankBids(nextBids));
    setSelectedBidId(null);
    addJournal(roleLabels[role], `подана ставка ${rub(nextPrice)} / т`);
  }

  function withdrawBid() {
    if (!(role === 'buyer1' || role === 'buyer2') || !buyerOwnBid || dealCreated) return;
    setBids(rankBids(bids.map((bid) => bid.id === buyerOwnBid.id ? { ...bid, withdrawn: true } : bid)));
    addJournal(roleLabels[role], `ставка отозвана: ${buyerOwnBid.id}`);
  }

  function selectWinner() {
    if (!canSelectWinner || !leader) return;
    setSelectedBidId(leader.id);
    setBids(bids.map((bid) => bid.id === leader.id ? { ...bid, status: 'winner' } : bid.status === 'blocked' ? bid : { ...bid, status: 'outbid' }));
    addJournal(roleLabels[role], `выбран победитель: ${leader.buyer}`);
  }

  function createDeal() {
    if (!selectedBid || blockedByGate) return;
    setDealCreated(true);
    addJournal('Система', `создана сделка ${simulation.resultingDealId ?? 'DL-SIM'} по ставке ${selectedBid.id}`);
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={eyebrow()}>Торговый контур · simulation-grade</div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, lineHeight: 1.1 }}>{simulation.lot.id} · {simulation.lot.title}</h1>
            <p style={mutedText()}>Лот, ставки, выбор победителя и создание сделки связаны в одну цепочку. Все роли читают один state.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Badge tone={blockedByGate ? 'red' : 'green'}>{simulation.gateLabel}</Badge>
            <Badge tone={dealCreated ? 'green' : closedByTimer ? 'amber' : 'blue'}>{dealCreated ? 'Сделка создана' : closedByTimer ? 'Торг закрыт' : 'Торг активен'}</Badge>
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <Metric label="Режим" value={modeLabels[mode]} />
          <Metric label="Таймер" value={`${minutes}:${seconds}`} danger={secondsLeft <= 120 && !closedByTimer} />
          <Metric label="Лидер" value={leader ? leader.buyer : '—'} />
          <Metric label="Лучшая цена" value={leader ? `${rub(leader.pricePerTon)} / т` : '—'} />
          <Metric label="Сумма" value={leader ? rub(leader.pricePerTon * leader.volumeTons) : '—'} />
        </div>
      </section>

      <section style={card()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={sectionTitle()}>Роль и режим торгов</div>
            <div style={mutedText()}>Один экран показывает, что видит каждая сторона. В закрытом режиме покупатель не видит цены конкурентов.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {(['seller', 'buyer1', 'buyer2', 'operator'] as SimRole[]).map((item) => (
              <button key={item} onClick={() => setRole(item)} style={button(role === item ? 'primary' : 'default')}>{roleLabels[item]}</button>
            ))}
            {(['open', 'closed', 'fixed', 'negotiation'] as AuctionMode[]).map((item) => (
              <button key={item} onClick={() => setMode(item)} style={button(mode === item ? 'primary' : 'default')}>{modeLabels[item]}</button>
            ))}
          </div>
        </div>
      </section>

      <section style={card()}>
        <div style={sectionTitle()}>Ставки</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {bids.map((bid) => (
            <div key={bid.id} style={{ border: '1px solid var(--pc-border)', borderRadius: 16, padding: 14, background: bid.id === leader?.id ? 'var(--pc-accent-bg)' : 'var(--pc-bg-elevated)', display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong>{visibleBidLabel(bid, role, mode)}</strong>
                <Badge tone={statusTone(bid.status, bid.withdrawn) as any}>{statusText(bid.status, bid.withdrawn)}</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
                <Small label="Цена" value={visiblePrice(bid, role, mode)} />
                <Small label="Объём" value={`${bid.volumeTons} т`} />
                <Small label="Оплата" value={mode === 'closed' && role.startsWith('buyer') && bid.buyer !== buyerNames[role as 'buyer1' | 'buyer2'] ? 'скрыто' : bid.payment} />
                <Small label="Логистика" value={mode === 'closed' && role.startsWith('buyer') && bid.buyer !== buyerNames[role as 'buyer1' | 'buyer2'] ? 'скрыто' : bid.logistics} />
                <Small label="Следующий шаг" value={bid.nextStep} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={card()}>
        <div style={sectionTitle()}>Действия</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button disabled={!canBid} onClick={placeBid} style={button(canBid ? 'primary' : 'disabled')}>Подать / повысить ставку</button>
          <button disabled={!(role === 'buyer1' || role === 'buyer2') || !buyerOwnBid || dealCreated} onClick={withdrawBid} style={button('default')}>Отозвать ставку</button>
          <button disabled={!canSelectWinner} onClick={selectWinner} style={button(canSelectWinner ? 'primary' : 'disabled')}>Выбрать победителя</button>
          <button disabled={!selectedBid || dealCreated || blockedByGate} onClick={createDeal} style={button(selectedBid && !dealCreated && !blockedByGate ? 'primary' : 'disabled')}>Создать сделку</button>
          {dealCreated && simulation.resultingDealId ? <button onClick={() => router.push(`/platform-v7/deals/${simulation.resultingDealId}`)} style={button('primary')}>Перейти к сделке</button> : null}
        </div>
        {blockedByGate ? <p style={{ ...mutedText(), color: '#B91C1C' }}>Торг остановлен: {simulation.lot.readiness.nextStep}</p> : null}
      </section>

      <section style={card()}>
        <div style={sectionTitle()}>Замыкание ролей</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {simulation.roleClosures.map((item) => (
            <div key={item.role} style={{ border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12, display: 'grid', gap: 4 }}>
              <strong>{item.label}</strong>
              <span style={mutedText()}>{item.sees}</span>
              <span style={mutedText()}>Действие: {item.action}</span>
              <Link href={item.next} style={{ color: 'var(--pc-accent-strong)', fontWeight: 800, textDecoration: 'none' }}>Следующий экран →</Link>
            </div>
          ))}
        </div>
      </section>

      <section style={card()}>
        <div style={sectionTitle()}>Журнал торгов</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {journal.map((item, index) => (
            <div key={`${item.time}-${index}`} style={{ display: 'grid', gridTemplateColumns: '70px 130px 1fr', gap: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--pc-text-secondary)' }}>{item.time}</span>
              <strong>{item.actor}</strong>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/platform-v7/lots" style={linkBtn()}>Все лоты</Link>
        <Link href={`/platform-v7/buyer?auction=${simulation.auctionId}`} style={linkBtn()}>Вид покупателя</Link>
        <Link href="/platform-v7/control-tower" style={linkBtn()}>Центр управления</Link>
        {simulation.resultingDealId ? <Link href={`/platform-v7/deals/${simulation.resultingDealId}`} style={linkBtn()}>Связанная сделка</Link> : null}
      </section>
    </div>
  );
}

function card(): React.CSSProperties { return { background: 'var(--pc-bg-card)', border: '1px solid var(--pc-border)', borderRadius: 18, padding: 18 }; }
function eyebrow(): React.CSSProperties { return { fontSize: 12, color: 'var(--pc-text-secondary)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }; }
function mutedText(): React.CSSProperties { return { margin: '6px 0 0', color: 'var(--pc-text-secondary)', fontSize: 13, lineHeight: 1.55 }; }
function sectionTitle(): React.CSSProperties { return { fontSize: 18, fontWeight: 900, color: 'var(--pc-text-primary)' }; }
function button(kind: 'default' | 'primary' | 'disabled'): React.CSSProperties { return { borderRadius: 12, padding: '10px 13px', border: kind === 'primary' ? '1px solid var(--pc-accent-border)' : '1px solid var(--pc-border)', background: kind === 'primary' ? 'var(--pc-accent-bg)' : 'var(--pc-bg-elevated)', color: kind === 'disabled' ? 'var(--pc-text-muted)' : kind === 'primary' ? 'var(--pc-accent-strong)' : 'var(--pc-text-primary)', fontWeight: 800, cursor: kind === 'disabled' ? 'not-allowed' : 'pointer' }; }
function linkBtn(): React.CSSProperties { return { textDecoration: 'none', borderRadius: 12, padding: '10px 13px', border: '1px solid var(--pc-border)', background: 'var(--pc-bg-card)', color: 'var(--pc-text-primary)', fontWeight: 800 }; }

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) { return <div style={{ border: '1px solid var(--pc-border)', borderRadius: 14, padding: 12 }}><div style={eyebrow()}>{label}</div><div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: danger ? '#B91C1C' : 'var(--pc-text-primary)' }}>{value}</div></div>; }
function Small({ label, value }: { label: string; value: string }) { return <div><div style={eyebrow()}>{label}</div><div style={{ marginTop: 4, fontWeight: 800 }}>{value}</div></div>; }
function Badge({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'blue' | 'neutral'; children: React.ReactNode }) { const map = { green: ['rgba(22,163,74,.08)', '#15803D'], red: ['rgba(220,38,38,.08)', '#B91C1C'], amber: ['rgba(217,119,6,.08)', '#B45309'], blue: ['rgba(37,99,235,.08)', '#1D4ED8'], neutral: ['rgba(100,116,139,.08)', '#475569'] } as const; return <span style={{ borderRadius: 999, padding: '5px 9px', background: map[tone][0], color: map[tone][1], fontSize: 12, fontWeight: 900 }}>{children}</span>; }
