'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  acceptBid,
  rejectBid,
  submitBid,
  updateBid,
  withdrawBid,
  type Bid,
  type Lot,
  type RejectionReason,
} from '@/lib/platform-v7/execution-contour';

type Mode = 'seller' | 'buyer';

type JournalEntry = {
  readonly id: string;
  readonly title: string;
  readonly details: string;
};

const mutedStyle = { color: '#667085', fontSize: 13, lineHeight: 1.55 } as const;
const numberStyle = { fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' } as const;
const cardStyle = {
  border: '1px solid #E4E6EA',
  borderRadius: 20,
  background: '#FFFFFF',
  padding: 18,
  display: 'grid',
  gap: 12,
  minWidth: 0,
} as const;
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
} as const;
const buttonStyle = {
  minHeight: 44,
  border: 0,
  borderRadius: 14,
  background: '#0A7A5F',
  color: '#FFFFFF',
  padding: '0 14px',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
} as const;
const secondaryButtonStyle = {
  ...buttonStyle,
  background: '#FFFFFF',
  color: '#344054',
  border: '1px solid #D0D5DD',
} as const;

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
  return (
    <div style={{ minWidth: 0 }}>
      <div style={mutedStyle}>{label}</div>
      <div style={{ ...numberStyle, fontSize: 17, fontWeight: 800, color: '#101828' }}>{value}</div>
    </div>
  );
}

function Pill({ children }: { readonly children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', minHeight: 28, alignItems: 'center', borderRadius: 999, border: '1px solid #D0D5DD', padding: '0 10px', color: '#344054', fontSize: 12, fontWeight: 700 }}>
      {children}
    </span>
  );
}

function sortBids(bids: readonly Bid[]): Bid[] {
  return [...bids].sort((a, b) => {
    const statusWeight = (status: Bid['status']) => status === 'accepted' ? 4 : status === 'leading' ? 3 : status === 'submitted' ? 2 : status === 'outbid' ? 1 : 0;
    return statusWeight(b.status) - statusWeight(a.status) || b.pricePerTon - a.pricePerTon;
  });
}

export function BidLifecyclePanel({ lot, initialBids, mode }: { readonly lot: Lot; readonly initialBids: readonly Bid[]; readonly mode: Mode }) {
  const [bids, setBids] = useState<Bid[]>(() => [...initialBids]);
  const [notice, setNotice] = useState<string>('Действия не отправляются наружу: это управляемый пилотный сценарий интерфейса.');
  const [journal, setJournal] = useState<JournalEntry[]>([
    { id: 'journal-start', title: 'Открыта карточка ставок', details: mode === 'seller' ? 'Продавец видит сравнение ставок по своему лоту.' : 'Покупатель видит только свою ставку и свои действия.' },
  ]);

  const acceptedBid = bids.find((bid) => bid.status === 'accepted');
  const sortedBids = useMemo(() => sortBids(bids), [bids]);
  const buyerCanSubmit = mode === 'buyer' && !bids.some((bid) => ['submitted', 'leading', 'accepted'].includes(bid.status));

  function pushJournal(title: string, details: string) {
    const entry: JournalEntry = { id: `journal-${Date.now()}-${Math.random()}`, title, details };
    setJournal((current) => [entry, ...current].slice(0, 8));
    setNotice(details);
  }

  function replaceBid(nextBid: Bid) {
    setBids((current) => current.map((bid) => bid.bidId === nextBid.bidId ? nextBid : bid));
  }

  function handleAccept(bidId: string) {
    try {
      const result = acceptBid({ lot, bids, bidId, actorRole: 'seller' });
      setBids(result.bids);
      pushJournal('Ставка принята', `Создана сделка ${result.deal.dealId}. Условия ставки заморожены.`);
    } catch (error) {
      pushJournal('Действие остановлено', error instanceof Error ? error.message : 'Не удалось принять ставку.');
    }
  }

  function handleReject(bid: Bid) {
    const reason: RejectionReason = 'Цена ниже ожидания';
    try {
      const nextBid = rejectBid(bid, reason);
      replaceBid(nextBid);
      pushJournal('Ставка отклонена', `${bid.buyerAlias ?? 'Покупатель'}: ${reason}.`);
    } catch (error) {
      pushJournal('Действие остановлено', error instanceof Error ? error.message : 'Не удалось отклонить ставку.');
    }
  }

  function handleClarify(bid: Bid) {
    pushJournal('Запрошено уточнение', `${bid.buyerAlias ?? 'Покупатель'} должен подтвердить окно вывоза, документы и условия оплаты.`);
  }

  function handleImprove(bid: Bid) {
    try {
      const nextBid = updateBid(bid, { pricePerTon: bid.pricePerTon + 100, comment: 'Цена повышена покупателем в пилотном интерфейсе.' });
      replaceBid(nextBid);
      pushJournal('Ставка изменена', `Новая цена: ${money(nextBid.pricePerTon)}/т. Сумма пересчитана автоматически.`);
    } catch (error) {
      pushJournal('Действие остановлено', error instanceof Error ? error.message : 'Не удалось изменить ставку.');
    }
  }

  function handleWithdraw(bid: Bid) {
    try {
      const nextBid = withdrawBid(bid);
      replaceBid(nextBid);
      pushJournal('Ставка отозвана', 'Покупатель убрал ставку из активного сравнения.');
    } catch (error) {
      pushJournal('Действие остановлено', error instanceof Error ? error.message : 'Не удалось отозвать ставку.');
    }
  }

  function handleSubmit() {
    const nextBid = submitBid({
      lotId: lot.lotId,
      buyerId: 'cp-buyer-2',
      buyerAlias: mode === 'seller' ? 'Покупатель B' : undefined,
      pricePerTon: lot.targetPricePerTon,
      volumeTons: lot.volumeTons,
      paymentTerms: 'bank_reserve',
      logisticsOption: 'platform_logistics_required',
      pickupWindow: '02.05.2026 08:00–14:00',
      documentsRequired: ['СДИЗ', 'УПД', 'ЭТрН', 'путевой лист'],
      comment: 'Новая ставка из пилотного интерфейса.',
    }, '2026-05-01T09:15:00.000Z');
    setBids((current) => [nextBid, ...current]);
    pushJournal('Ставка отправлена', `Создана новая ставка на ${money(nextBid.totalAmount)}.`);
  }

  return (
    <section style={{ display: 'grid', gap: 14 }} data-testid={`platform-v7-bid-lifecycle-${mode}`}>
      <article style={{ ...cardStyle, background: '#F8FAFB' }} aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <strong>{mode === 'seller' ? 'Действия продавца по ставкам' : 'Действия покупателя по своей ставке'}</strong>
            <div style={mutedStyle}>{notice}</div>
          </div>
          <Pill>{acceptedBid ? `принята ${acceptedBid.bidId}` : 'выбор не сделан'}</Pill>
        </div>
        {buyerCanSubmit ? <button type="button" style={buttonStyle} onClick={handleSubmit}>Отправить новую ставку</button> : null}
      </article>

      <div style={gridStyle}>
        {sortedBids.map((bid) => {
          const closed = ['accepted', 'rejected', 'withdrawn', 'expired'].includes(bid.status);
          const name = mode === 'seller' ? (bid.buyerAlias ?? bid.buyerId) : 'Ваша ставка';
          return (
            <article key={bid.bidId} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{name}</strong>
                <Pill>{statusLabel(bid.status)}</Pill>
              </div>
              <div style={gridStyle}>
                <Metric label="Цена" value={`${money(bid.pricePerTon)}/т`} />
                <Metric label="Объём" value={`${bid.volumeTons} т`} />
                <Metric label="Сумма" value={money(bid.totalAmount)} />
                <Metric label="Оплата" value={paymentLabel(bid.paymentTerms)} />
              </div>
              <div style={mutedStyle}>Логистика: {bid.logisticsOption === 'platform_logistics_required' ? 'нужна логистика платформы' : 'самовывоз'} · окно: {bid.pickupWindow}</div>
              {mode === 'seller' ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={buttonStyle} disabled={closed || Boolean(acceptedBid)} onClick={() => handleAccept(bid.bidId)}>Принять</button>
                  <button type="button" style={secondaryButtonStyle} disabled={closed || Boolean(acceptedBid)} onClick={() => handleClarify(bid)}>Запросить уточнение</button>
                  <button type="button" style={secondaryButtonStyle} disabled={closed || Boolean(acceptedBid)} onClick={() => handleReject(bid)}>Отклонить с причиной</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={buttonStyle} disabled={closed} onClick={() => handleImprove(bid)}>Повысить на 100 ₽/т</button>
                  <button type="button" style={secondaryButtonStyle} disabled={closed} onClick={() => handleWithdraw(bid)}>Отозвать ставку</button>
                </div>
              )}
              {mode === 'seller' ? <div style={mutedStyle}>Минимум продавца: {lot.minAcceptablePricePerTon ? `${money(lot.minAcceptablePricePerTon)}/т` : '—'} · отклонение без причины запрещено.</div> : null}
            </article>
          );
        })}
      </div>

      <article style={cardStyle} data-testid={`platform-v7-bid-journal-${mode}`}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Журнал действий</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {journal.map((entry) => (
            <div key={entry.id} style={{ borderTop: '1px solid #E4E6EA', paddingTop: 10 }}>
              <strong>{entry.title}</strong>
              <div style={mutedStyle}>{entry.details}</div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
