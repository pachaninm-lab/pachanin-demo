'use client';

import { useMemo, useState } from 'react';
import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';
import {
  acceptBid,
  acceptLogisticsQuoteCreateTrip,
  createLogisticsRequestFromDeal,
  executionContourFixtures,
  submitLogisticsQuote,
  type LogisticsQuote,
  type LogisticsRequest,
  type Trip,
} from '@/lib/platform-v7/execution-contour';

type LogisticsEvent = {
  readonly id: string;
  readonly title: string;
  readonly details: string;
};

const baseAccepted = acceptBid({ lot: executionContourFixtures.lots[0], bids: executionContourFixtures.bids, bidId: 'BID-7002' });
const initialRequest = createLogisticsRequestFromDeal(baseAccepted.deal);

const cardStyle = { border: '1px solid #E4E6EA', borderRadius: 20, background: '#FFFFFF', padding: 18, display: 'grid', gap: 12, minWidth: 0 } as const;
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 } as const;
const mutedStyle = { color: '#667085', fontSize: 13, lineHeight: 1.55 } as const;
const numberStyle = { fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' } as const;
const buttonStyle = { minHeight: 44, border: 0, borderRadius: 14, background: '#0A7A5F', color: '#FFFFFF', padding: '0 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' } as const;
const secondaryButtonStyle = { ...buttonStyle, background: '#FFFFFF', color: '#344054', border: '1px solid #D0D5DD' } as const;

function money(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={mutedStyle}>{label}</div>
      <div style={{ ...numberStyle, fontSize: 17, fontWeight: 800, color: '#101828' }}>{value}</div>
    </div>
  );
}

function Pill({ children }: { readonly children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', minHeight: 28, alignItems: 'center', borderRadius: 999, border: '1px solid #D0D5DD', padding: '0 10px', color: '#344054', fontSize: 12, fontWeight: 700 }}>{children}</span>;
}

function requestStatusLabel(status: LogisticsRequest['status']): string {
  const labels: Record<LogisticsRequest['status'], string> = {
    draft: 'черновик',
    sent: 'отправлена',
    viewed: 'просмотрена',
    quoted: 'есть предложение',
    accepted: 'принята',
    rejected: 'отклонена',
    assigned: 'рейс назначен',
    in_transit: 'в пути',
    completed: 'завершена',
    cancelled: 'отменена',
  };
  return labels[status];
}

function quoteStatusLabel(status: LogisticsQuote['status']): string {
  const labels: Record<LogisticsQuote['status'], string> = {
    submitted: 'активно',
    accepted: 'выбрано',
    rejected: 'отклонено',
    withdrawn: 'отозвано',
    expired: 'истекло',
  };
  return labels[status];
}

function eventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function PlatformV7LogisticsLifecyclePage() {
  const [request, setRequest] = useState<LogisticsRequest>(initialRequest);
  const [quotes, setQuotes] = useState<LogisticsQuote[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [notice, setNotice] = useState('Логистика видит только перевозочную часть: груз, маршрут, окна, требования и документы.');
  const [events, setEvents] = useState<LogisticsEvent[]>([
    { id: 'log-start', title: 'Заявка создана из сделки', details: `${initialRequest.requestId} связана со сделкой ${initialRequest.dealId}.` },
  ]);

  const activeQuote = useMemo(() => quotes.find((quote) => quote.status === 'submitted'), [quotes]);

  function push(title: string, details: string) {
    setEvents((current) => [{ id: eventId('log'), title, details }, ...current].slice(0, 8));
    setNotice(details);
  }

  function sendRequest() {
    if (request.status !== 'draft') return;
    setRequest((current) => ({ ...current, status: 'sent' }));
    push('Заявка отправлена перевозчику', 'Перевозчик получил груз, маршрут, окна, требования к ТС и список документов.');
  }

  function markViewed() {
    if (!['sent', 'draft'].includes(request.status)) return;
    setRequest((current) => ({ ...current, status: 'viewed' }));
    push('Заявка просмотрена', 'Перевозчик открыл заявку и должен дать ответ в рамках SLA.');
  }

  function submitQuote() {
    if (quotes.some((quote) => quote.status === 'submitted')) return;
    const quote = submitLogisticsQuote({
      requestId: request.requestId,
      carrierId: 'cp-carrier-1',
      rateType: 'per_ton',
      rate: 2400,
      vehicleType: 'зерновоз',
      vehicleNumber: 'А123ВС68',
      driverCandidate: 'driver-2041',
      etaPickup: '2026-05-02T08:00:00.000Z',
      etaDelivery: '2026-05-03T09:00:00.000Z',
      conditions: 'GPS, пломба, фото погрузки и ЭТрН обязательны.',
    });
    setQuotes((current) => [quote, ...current]);
    setRequest((current) => ({ ...current, status: 'quoted' }));
    push('Перевозчик предложил условия', `Ставка перевозки ${money(quote.rate)}/т, ТС: ${quote.vehicleType}.`);
  }

  function acceptQuote() {
    const quote = activeQuote;
    if (!quote || trip) return;
    const assigned = acceptLogisticsQuoteCreateTrip({ request, quote, driverId: 'driver-2041', vehicleId: 'truck-2041' });
    setRequest(assigned.request);
    setQuotes((current) => current.map((item) => item.quoteId === quote.quoteId ? assigned.quote : item));
    setTrip(assigned.trip);
    push('Предложение выбрано, рейс создан', `Создан рейс ${assigned.trip.tripId}. Назначены водитель и машина.`);
  }

  function rejectQuote() {
    const quote = activeQuote;
    if (!quote || trip) return;
    setQuotes((current) => current.map((item) => item.quoteId === quote.quoteId ? { ...item, status: 'rejected' } : item));
    setRequest((current) => ({ ...current, status: 'sent' }));
    push('Предложение перевозчика отклонено', 'Причина: не подходит ставка или окно подачи. Можно запросить новое предложение.');
  }

  return (
    <P7Page title="Логистика: входящие заявки" subtitle="Заявка из сделки проходит путь: отправка перевозчику → предложение → выбор → рейс." testId="platform-v7-logistics-lifecycle">
      <P7Section title="Заявка на перевозку" subtitle={notice}>
        <article style={cardStyle} data-testid="platform-v7-logistics-request-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{request.requestId}</h2>
            <Pill>{requestStatusLabel(request.status)}</Pill>
          </div>
          <div style={gridStyle}>
            <Metric label="Сделка" value={request.dealId} />
            <Metric label="Груз" value={`${request.cargo.crop} · ${request.cargo.grade} · ${request.cargo.volumeTons} т`} />
            <Metric label="Маршрут" value="Тамбов → Воронеж" />
            <Metric label="SLA ответа" value="2 часа" />
          </div>
          <div style={mutedStyle}>Окно погрузки: {request.pickupWindow} · окно выгрузки: {request.deliveryWindow}</div>
          <div style={mutedStyle}>Требования: {request.vehicleRequirements.join(', ')} · документы: {request.documentsRequired.join(', ')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} disabled={request.status !== 'draft'} onClick={sendRequest}>Отправить в логистику</button>
            <button type="button" style={secondaryButtonStyle} disabled={!['sent', 'draft'].includes(request.status)} onClick={markViewed}>Отметить просмотр</button>
            <button type="button" style={secondaryButtonStyle} disabled={Boolean(activeQuote) || Boolean(trip)} onClick={submitQuote}>Предложить условия</button>
          </div>
        </article>
      </P7Section>

      <P7Section title="Предложения перевозчиков" subtitle="Перевозчик не видит цену зерна, ставки покупателей, банковый резерв и маржу сделки.">
        <div style={gridStyle}>
          {quotes.length === 0 ? <article style={cardStyle}><strong>Предложений пока нет</strong><div style={mutedStyle}>После ответа перевозчика здесь появятся ставка, ТС, водитель и ETA.</div></article> : null}
          {quotes.map((quote) => (
            <article key={quote.quoteId} style={cardStyle} data-testid="platform-v7-logistics-quote-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{quote.quoteId}</strong>
                <Pill>{quoteStatusLabel(quote.status)}</Pill>
              </div>
              <div style={gridStyle}>
                <Metric label="Ставка" value={`${money(quote.rate)}/т`} />
                <Metric label="ТС" value={quote.vehicleType} />
                <Metric label="Водитель" value={quote.driverCandidate || '—'} />
                <Metric label="Подача" value="02.05 08:00" />
              </div>
              <div style={mutedStyle}>{quote.conditions}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={buttonStyle} disabled={quote.status !== 'submitted' || Boolean(trip)} onClick={acceptQuote}>Выбрать предложение</button>
                <button type="button" style={secondaryButtonStyle} disabled={quote.status !== 'submitted' || Boolean(trip)} onClick={rejectQuote}>Отклонить предложение</button>
              </div>
            </article>
          ))}
        </div>
      </P7Section>

      <P7Section title="Рейс" subtitle="После выбора предложения создаётся рейс с водителем, машиной, документами и полевыми событиями.">
        {trip ? (
          <article style={cardStyle} data-testid="platform-v7-trip-created-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>{trip.tripId}</h2>
              <Pill>водитель назначен</Pill>
            </div>
            <div style={gridStyle}>
              <Metric label="Сделка" value={trip.dealId} />
              <Metric label="Заявка" value={trip.logisticsRequestId} />
              <Metric label="Водитель" value={trip.driverId} />
              <Metric label="Машина" value={trip.vehicleId} />
            </div>
            <div style={mutedStyle}>Документы рейса: {trip.documentPack.join(', ')}</div>
          </article>
        ) : (
          <article style={cardStyle}><strong>Рейс ещё не создан</strong><div style={mutedStyle}>Нужно выбрать предложение перевозчика и назначить водителя.</div></article>
        )}
      </P7Section>

      <P7Section title="Журнал логистики">
        <div style={{ display: 'grid', gap: 10 }} data-testid="platform-v7-logistics-journal">
          {events.map((event) => <article key={event.id} style={cardStyle}><strong>{event.title}</strong><div style={mutedStyle}>{event.details}</div></article>)}
        </div>
      </P7Section>
    </P7Page>
  );
}

export function PlatformV7TripLifecyclePage() {
  return (
    <P7Page title="Рейс TR-2041" subtitle="Рейс связан со сделкой, логистической заявкой, перевозчиком, водителем, GPS, фото, пломбой, весом и документами." testId="platform-v7-trip-lifecycle">
      <P7Section title="Карточка рейса">
        <article style={cardStyle}>
          <div style={gridStyle}>
            <Metric label="Рейс" value="TR-2041" />
            <Metric label="Сделка" value="DL-9116" />
            <Metric label="Заявка" value="LR-2041" />
            <Metric label="Статус" value="водитель назначен" />
          </div>
          <div style={mutedStyle}>Следующие действия: прибытие на погрузку, фото, пломба, начало рейса, выгрузка, вес.</div>
        </article>
      </P7Section>
      <P7Section title="Полевые подтверждения">
        <div style={gridStyle}>
          <article style={cardStyle}><strong>GPS</strong><div style={mutedStyle}>Ожидает первую точку водителя.</div></article>
          <article style={cardStyle}><strong>Фото</strong><div style={mutedStyle}>Ожидает фото погрузки и пломбы.</div></article>
          <article style={cardStyle}><strong>Пломба</strong><div style={mutedStyle}>Ожидает подтверждение номера.</div></article>
          <article style={cardStyle}><strong>Документы</strong><div style={mutedStyle}>ЭТрН, путевой лист, СДИЗ, доверенность.</div></article>
        </div>
      </P7Section>
    </P7Page>
  );
}
