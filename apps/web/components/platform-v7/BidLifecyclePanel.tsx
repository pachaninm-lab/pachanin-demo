'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { applyCsrfHeader } from '@/lib/csrf';
import type { Bid, Lot } from '@/lib/platform-v7/execution-contour';
import type { BidRuntimeAction, BidRuntimeEvent } from '@/lib/platform-v7/bid-runtime-store';

type Mode = 'seller' | 'buyer';

type JournalEntry = {
  readonly id: string;
  readonly title: string;
  readonly details: string;
};

type RuntimeView = {
  readonly ok?: boolean;
  readonly revision?: number;
  readonly lot?: Lot;
  readonly bids?: Bid[];
  readonly events?: BidRuntimeEvent[];
  readonly command?: { readonly status?: string; readonly error?: string };
  readonly event?: BidRuntimeEvent | null;
  readonly error?: string;
};

const mutedStyle = { color: '#667085', fontSize: 13, lineHeight: 1.55 } as const;
const numberStyle = { fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' } as const;
const cardStyle = { border: '1px solid #E4E6EA', borderRadius: 20, background: '#FFFFFF', padding: 18, display: 'grid', gap: 12, minWidth: 0 } as const;
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 } as const;
const buttonStyle = { minHeight: 44, border: 0, borderRadius: 14, background: '#0A7A5F', color: '#FFFFFF', padding: '0 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' } as const;
const secondaryButtonStyle = { ...buttonStyle, background: '#FFFFFF', color: '#344054', border: '1px solid #D0D5DD' } as const;

function money(value: number): string {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}

function statusLabel(status: Bid['status']): string {
  const labels: Record<Bid['status'], string> = {
    submitted: 'активна',
    leading: 'лидирует',
    outbid: 'перебита',
    accepted: 'принята',
    rejected: 'отклонена',
    withdrawn: 'отозвана',
    expired: 'истекла',
  };
  return labels[status];
}

function paymentLabel(paymentTerms: Bid['paymentTerms']): string {
  const labels: Record<Bid['paymentTerms'], string> = {
    bank_reserve: 'резерв денег',
    postpay: 'постоплата',
    partial_prepay: 'частичная предоплата',
    custom: 'индивидуально',
  };
  return labels[paymentTerms];
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div style={{ minWidth: 0 }}><div style={mutedStyle}>{label}</div><div style={{ ...numberStyle, fontSize: 17, fontWeight: 800, color: '#101828' }}>{value}</div></div>;
}

function Pill({ children }: { readonly children: ReactNode }) {
  return <span style={{ display: 'inline-flex', minHeight: 28, alignItems: 'center', borderRadius: 999, border: '1px solid #D0D5DD', padding: '0 10px', color: '#344054', fontSize: 12, fontWeight: 700 }}>{children}</span>;
}

function sortBids(bids: readonly Bid[]): Bid[] {
  return [...bids].sort((a, b) => {
    const statusWeight = (status: Bid['status']) => status === 'accepted' ? 4 : status === 'leading' ? 3 : status === 'submitted' ? 2 : status === 'outbid' ? 1 : 0;
    return statusWeight(b.status) - statusWeight(a.status) || b.pricePerTon - a.pricePerTon;
  });
}

function eventsToJournal(events: readonly BidRuntimeEvent[] | undefined, fallback: JournalEntry[]): JournalEntry[] {
  if (!events?.length) return fallback;
  return events.map((event) => ({ id: event.eventId, title: event.title, details: event.details })).slice(0, 8);
}

export function BidLifecyclePanel({ lot, initialBids, mode }: { readonly lot: Lot; readonly initialBids: readonly Bid[]; readonly mode: Mode }) {
  const [scopeId] = useState(() => `platform-v7-${mode}-${lot.lotId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  const [bids, setBids] = useState<Bid[]>(() => [...initialBids]);
  const [revision, setRevision] = useState<number>(1);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('Подключаем серверный журнал пилотного сценария.');
  const [journal, setJournal] = useState<JournalEntry[]>([
    { id: 'journal-start', title: 'Открыта карточка ставок', details: mode === 'seller' ? 'Продавец видит сравнение ставок по своему лоту.' : 'Покупатель видит только свою ставку и свои действия.' },
  ]);

  const role = mode === 'buyer' ? 'buyer' : 'seller';
  const viewerCounterpartyId = mode === 'buyer' ? 'cp-buyer-2' : undefined;
  const acceptedBid = bids.find((bid) => bid.status === 'accepted');
  const sortedBids = useMemo(() => sortBids(bids), [bids]);
  const buyerCanSubmit = mode === 'buyer' && !bids.some((bid) => ['submitted', 'leading', 'accepted'].includes(bid.status));

  function applyRuntimeView(payload: RuntimeView) {
    if (payload.bids) setBids(payload.bids);
    if (typeof payload.revision === 'number') setRevision(payload.revision);
    setJournal((current) => eventsToJournal(payload.events, current));
    if (payload.command?.status === 'FAILED') {
      const message = payload.command.error || payload.event?.details || payload.error || 'Действие не выполнено. Состояние оставлено по последней серверной версии.';
      setLastError(message);
      setNotice(message);
      return;
    }
    if (payload.ok !== false) setLastError(null);
    if (payload.event?.details) setNotice(payload.event.details);
    if (payload.error) setNotice(payload.error);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadRuntimeView() {
      const params = new URLSearchParams({ scopeId, lotId: lot.lotId, role });
      if (viewerCounterpartyId) params.set('viewerCounterpartyId', viewerCounterpartyId);
      const response = await fetch(`/api/platform-v7/bids/runtime?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as RuntimeView | null;
      if (!cancelled && payload) {
        applyRuntimeView(payload);
        setRuntimeReady(true);
        if (!payload.event?.details && !payload.error) setNotice('Действия записываются в серверный журнал пилотного сценария.');
      }
    }
    void loadRuntimeView();
    return () => { cancelled = true; };
  }, [lot.lotId, role, scopeId, viewerCounterpartyId]);

  async function runCommand(action: BidRuntimeAction, bid?: Bid, extra?: Record<string, unknown>) {
    if (!runtimeReady) return;
    setIsPending(true);
    setLastError(null);
    try {
      const response = await fetch('/api/platform-v7/bids/runtime/command', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ scopeId, action, actorRole: role, lotId: lot.lotId, bidId: bid?.bidId, viewerCounterpartyId, idempotencyKey: `${scopeId}:${action}:${bid?.bidId || 'new'}:${revision}`, ...extra }),
      });
      const payload = await response.json().catch(() => null) as RuntimeView | null;
      if (payload) applyRuntimeView(payload);
      if (!response.ok && !payload?.error && !payload?.command?.error) {
        setLastError('Действие не выполнено. Состояние не изменено без подтверждения сервера.');
        setNotice('Действие не выполнено. Состояние не изменено без подтверждения сервера.');
      }
    } catch {
      setLastError('Нет связи с серверным журналом. Состояние не изменено без подтверждения сервера.');
      setNotice('Нет связи с серверным журналом. Состояние не изменено без подтверждения сервера.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: 14 }} data-testid={`platform-v7-bid-lifecycle-${mode}`}>
      <article style={{ ...cardStyle, background: '#F8FAFB' }} aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <strong>{mode === 'seller' ? 'Действия продавца по ставкам' : 'Действия покупателя по своей ставке'}</strong>
            <div style={mutedStyle}>{notice}</div>
          </div>
          <Pill>{acceptedBid ? `принята ${acceptedBid.bidId}` : runtimeReady ? `журнал ${revision}` : 'подключение'}</Pill>
        </div>
        {lastError ? <div data-testid={`platform-v7-bid-command-error-${mode}`} style={{ border: '1px solid #FDA29B', background: '#FFFBFA', color: '#B42318', borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 800 }}>Команда остановлена: {lastError}</div> : null}
        {buyerCanSubmit ? <button type="button" style={buttonStyle} disabled={isPending || !runtimeReady} onClick={() => void runCommand('submit_bid')}>Отправить новую ставку</button> : null}
      </article>

      <div style={gridStyle}>
        {sortedBids.map((bid) => {
          const closed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(bid.status);
          const name = mode === 'seller' ? (bid.buyerAlias ?? bid.buyerId) : 'Ваша ставка';
          const disabled = !runtimeReady || isPending || closed || Boolean(acceptedBid && mode === 'seller');
          return (
            <article key={bid.bidId} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{name}</strong><Pill>{statusLabel(bid.status)}</Pill></div>
              <div style={gridStyle}><Metric label="Цена" value={`${money(bid.pricePerTon)}/т`} /><Metric label="Объём" value={`${bid.volumeTons} т`} /><Metric label="Сумма" value={money(bid.totalAmount)} /><Metric label="Оплата" value={paymentLabel(bid.paymentTerms)} /></div>
              <div style={mutedStyle}>Логистика: {bid.logisticsOption === 'platform_logistics_required' ? 'нужна логистика платформы' : 'самовывоз'} · окно: {bid.pickupWindow}</div>
              {mode === 'seller' ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" style={buttonStyle} disabled={disabled} onClick={() => void runCommand('accept_bid', bid)}>Принять</button><button type="button" style={secondaryButtonStyle} disabled={disabled} onClick={() => void runCommand('clarify_bid', bid)}>Запросить уточнение</button><button type="button" style={secondaryButtonStyle} disabled={disabled} onClick={() => void runCommand('reject_bid', bid, { reason: 'Цена ниже ожидания' })}>Отклонить с причиной</button></div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" style={buttonStyle} disabled={!runtimeReady || isPending || closed} onClick={() => void runCommand('improve_bid', bid, { priceDelta: 100 })}>Повысить на 100 ₽/т</button><button type="button" style={secondaryButtonStyle} disabled={!runtimeReady || isPending || closed} onClick={() => void runCommand('withdraw_bid', bid)}>Отозвать ставку</button></div>
              )}
              {mode === 'seller' ? <div style={mutedStyle}>Минимум продавца: {lot.minAcceptablePricePerTon ? `${money(lot.minAcceptablePricePerTon)}/т` : '—'} · отклонение без причины запрещено.</div> : null}
            </article>
          );
        })}
      </div>

      <article style={cardStyle} data-testid={`platform-v7-bid-journal-${mode}`}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Журнал действий</h3>
        <div style={{ display: 'grid', gap: 10 }}>{journal.map((entry) => <div key={entry.id} style={{ borderTop: '1px solid #E4E6EA', paddingTop: 10 }}><strong>{entry.title}</strong><div style={mutedStyle}>{entry.details}</div></div>)}</div>
      </article>
    </section>
  );
}
