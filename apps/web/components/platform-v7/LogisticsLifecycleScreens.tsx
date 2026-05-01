'use client';

import { useEffect, useMemo, useState } from 'react';
import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';
import { applyCsrfHeader } from '@/lib/csrf';
import type { LogisticsQuote, LogisticsRequest, Trip } from '@/lib/platform-v7/execution-contour';
import type { LogisticsRuntimeAction, LogisticsRuntimeEvent } from '@/lib/platform-v7/logistics-runtime-store';

type RuntimeView = {
  readonly ok?: boolean;
  readonly scopeId?: string;
  readonly revision?: number;
  readonly request?: LogisticsRequest;
  readonly quotes?: LogisticsQuote[];
  readonly trip?: Trip | null;
  readonly events?: LogisticsRuntimeEvent[];
  readonly event?: LogisticsRuntimeEvent | null;
  readonly command?: { readonly status?: string; readonly error?: string };
  readonly error?: string;
};

const cardStyle = { border: '1px solid #E4E6EA', borderRadius: 20, background: '#FFFFFF', padding: 18, display: 'grid', gap: 12, minWidth: 0 } as const;
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 } as const;
const mutedStyle = { color: '#667085', fontSize: 13, lineHeight: 1.55 } as const;
const numberStyle = { fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' } as const;
const buttonStyle = { minHeight: 44, border: 0, borderRadius: 14, background: '#0A7A5F', color: '#FFFFFF', padding: '0 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer' } as const;
const secondaryButtonStyle = { ...buttonStyle, background: '#FFFFFF', color: '#344054', border: '1px solid #D0D5DD' } as const;
const errorStyle = { border: '1px solid #FDA29B', background: '#FFFBFA', color: '#B42318', borderRadius: 14, padding: 12, fontSize: 13, fontWeight: 800 } as const;

function money(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div style={{ minWidth: 0 }}><div style={mutedStyle}>{label}</div><div style={{ ...numberStyle, fontSize: 17, fontWeight: 800, color: '#101828' }}>{value}</div></div>;
}

function Pill({ children }: { readonly children: React.ReactNode }) {
  return <span style={{ display: 'inline-flex', minHeight: 28, alignItems: 'center', borderRadius: 999, border: '1px solid #D0D5DD', padding: '0 10px', color: '#344054', fontSize: 12, fontWeight: 700 }}>{children}</span>;
}

function requestStatusLabel(status: LogisticsRequest['status']): string {
  const labels: Record<LogisticsRequest['status'], string> = { draft: 'черновик', sent: 'отправлена', viewed: 'просмотрена', quoted: 'есть предложение', accepted: 'принята', rejected: 'отклонена', assigned: 'рейс назначен', in_transit: 'в пути', completed: 'завершена', cancelled: 'отменена' };
  return labels[status];
}

function quoteStatusLabel(status: LogisticsQuote['status']): string {
  const labels: Record<LogisticsQuote['status'], string> = { submitted: 'активно', accepted: 'выбрано', rejected: 'отклонено', withdrawn: 'отозвано', expired: 'истекло' };
  return labels[status];
}

function defaultRequest(): LogisticsRequest {
  return {
    requestId: 'LR-2041',
    dealId: 'DL-9116',
    lotId: 'LOT-2403',
    cargo: { crop: 'Пшеница', grade: '4 класс', volumeTons: 500 },
    pickupLocation: 'Тамбовская область, склад № 4',
    deliveryLocation: 'Воронежская область, элеватор № 2',
    pickupWindow: '02.05.2026 08:00–14:00',
    deliveryWindow: '03.05.2026 09:00–18:00',
    vehicleRequirements: ['зерновоз', 'GPS', 'пломба', 'фото погрузки'],
    documentsRequired: ['ЭТрН', 'путевой лист', 'СДИЗ', 'доверенность'],
    sealRequired: true,
    gpsRequired: true,
    targetRate: 2400,
    sentTo: ['cp-carrier-1'],
    status: 'draft',
    slaResponseAt: '2026-05-01T09:00:00.000Z',
  };
}

export function PlatformV7LogisticsLifecyclePage() {
  const [scopeId] = useState(() => `platform-v7-logistics-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  const [request, setRequest] = useState<LogisticsRequest>(() => defaultRequest());
  const [quotes, setQuotes] = useState<LogisticsQuote[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [events, setEvents] = useState<LogisticsRuntimeEvent[]>([]);
  const [revision, setRevision] = useState(1);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [notice, setNotice] = useState('Подключаем серверный журнал логистики.');

  const activeQuote = useMemo(() => quotes.find((quote) => quote.status === 'submitted'), [quotes]);

  function applyView(payload: RuntimeView) {
    if (payload.request) setRequest(payload.request);
    if (payload.quotes) setQuotes(payload.quotes);
    if (payload.trip !== undefined) setTrip(payload.trip);
    if (payload.events) setEvents(payload.events);
    if (typeof payload.revision === 'number') setRevision(payload.revision);
    if (payload.command?.status === 'FAILED') {
      const message = payload.command.error || payload.event?.details || payload.error || 'Действие логистики не выполнено. Состояние оставлено по последней серверной версии.';
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
    async function load() {
      const response = await fetch(`/api/platform-v7/logistics/runtime?scopeId=${scopeId}&actorRole=logistics`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as RuntimeView | null;
      if (!cancelled && payload) {
        applyView(payload);
        setRuntimeReady(true);
        if (!payload.event?.details && !payload.error) setNotice('Действия записываются в серверный журнал логистики.');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [scopeId]);

  async function runCommand(action: LogisticsRuntimeAction, quote?: LogisticsQuote) {
    if (!runtimeReady) return;
    setPending(true);
    setLastError(null);
    try {
      const response = await fetch('/api/platform-v7/logistics/runtime/command', {
        method: 'POST',
        headers: applyCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ scopeId, action, actorRole: 'logistics', requestId: request.requestId, quoteId: quote?.quoteId, idempotencyKey: `${scopeId}:${action}:${quote?.quoteId || request.requestId}:${revision}` }),
      });
      const payload = await response.json().catch(() => null) as RuntimeView | null;
      if (payload) applyView(payload);
      if (!response.ok && !payload?.error && !payload?.command?.error) {
        const message = 'Действие логистики не выполнено. Состояние не изменено без подтверждения сервера.';
        setLastError(message);
        setNotice(message);
      }
    } catch {
      const message = 'Нет связи с серверным журналом логистики. Состояние не изменено без подтверждения сервера.';
      setLastError(message);
      setNotice(message);
    } finally {
      setPending(false);
    }
  }

  const blocked = pending || !runtimeReady;

  return (
    <P7Page title="Логистика: входящие заявки" subtitle="Заявка из сделки проходит путь: отправка перевозчику → предложение → выбор → рейс." testId="platform-v7-logistics-lifecycle">
      <P7Section title="Заявка на перевозку" subtitle={notice}>
        <article style={cardStyle} data-testid="platform-v7-logistics-request-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>{request.requestId}</h2><Pill>{requestStatusLabel(request.status)}</Pill></div>
          {lastError ? <div data-testid="platform-v7-logistics-command-error" style={errorStyle}>Действие не выполнено: {lastError}</div> : null}
          <div style={gridStyle}>
            <Metric label="Сделка" value={request.dealId} />
            <Metric label="Груз" value={`${request.cargo.crop} · ${request.cargo.grade} · ${request.cargo.volumeTons} т`} />
            <Metric label="Маршрут" value="Тамбов → Воронеж" />
            <Metric label="Журнал" value={String(revision)} />
          </div>
          <div style={mutedStyle}>Окно погрузки: {request.pickupWindow} · окно выгрузки: {request.deliveryWindow}</div>
          <div style={mutedStyle}>Требования: {request.vehicleRequirements.join(', ')} · документы: {request.documentsRequired.join(', ')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} disabled={blocked || request.status !== 'draft'} onClick={() => void runCommand('send_request')}>Отправить в логистику</button>
            <button type="button" style={secondaryButtonStyle} disabled={blocked || !['sent', 'draft'].includes(request.status)} onClick={() => void runCommand('view_request')}>Отметить просмотр</button>
            <button type="button" style={secondaryButtonStyle} disabled={blocked || Boolean(activeQuote) || Boolean(trip)} onClick={() => void runCommand('submit_quote')}>Предложить условия</button>
          </div>
        </article>
      </P7Section>

      <P7Section title="Предложения перевозчиков" subtitle="Перевозчик не видит цену зерна, ставки покупателей, банковый резерв и маржу сделки.">
        <div style={gridStyle}>
          {quotes.length === 0 ? <article style={cardStyle}><strong>Предложений пока нет</strong><div style={mutedStyle}>После ответа перевозчика здесь появятся ставка, ТС, водитель и ETA.</div></article> : null}
          {quotes.map((quote) => <article key={quote.quoteId} style={cardStyle} data-testid="platform-v7-logistics-quote-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong>{quote.quoteId}</strong><Pill>{quoteStatusLabel(quote.status)}</Pill></div>
            <div style={gridStyle}><Metric label="Ставка" value={`${money(quote.rate)}/т`} /><Metric label="ТС" value={quote.vehicleType} /><Metric label="Водитель" value={quote.driverCandidate || '—'} /><Metric label="Подача" value="02.05 08:00" /></div>
            <div style={mutedStyle}>{quote.conditions}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyle} disabled={blocked || quote.status !== 'submitted' || Boolean(trip)} onClick={() => void runCommand('accept_quote', quote)}>Выбрать предложение</button>
              <button type="button" style={secondaryButtonStyle} disabled={blocked || quote.status !== 'submitted' || Boolean(trip)} onClick={() => void runCommand('reject_quote', quote)}>Отклонить предложение</button>
            </div>
          </article>)}
        </div>
      </P7Section>

      <P7Section title="Рейс" subtitle="После выбора предложения создаётся рейс с водителем, машиной, документами и полевыми событиями.">
        {trip ? <article style={cardStyle} data-testid="platform-v7-trip-created-card"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><h2 style={{ margin: 0 }}>{trip.tripId}</h2><Pill>водитель назначен</Pill></div><div style={gridStyle}><Metric label="Сделка" value={trip.dealId} /><Metric label="Заявка" value={trip.logisticsRequestId} /><Metric label="Водитель" value={trip.driverId} /><Metric label="Машина" value={trip.vehicleId} /></div><div style={mutedStyle}>Документы рейса: {trip.documentPack.join(', ')}</div></article> : <article style={cardStyle}><strong>Рейс ещё не создан</strong><div style={mutedStyle}>Нужно выбрать предложение перевозчика и назначить водителя.</div></article>}
      </P7Section>

      <P7Section title="Журнал логистики">
        <div style={{ display: 'grid', gap: 10 }} data-testid="platform-v7-logistics-journal">
          {events.map((event) => <article key={event.eventId} style={cardStyle}><strong>{event.title}</strong><div style={mutedStyle}>{event.details}</div></article>)}
        </div>
      </P7Section>
    </P7Page>
  );
}

export function PlatformV7TripLifecyclePage() {
  return <P7Page title="Рейс TR-2041" subtitle="Рейс связан со сделкой, логистической заявкой, перевозчиком, водителем, GPS, фото, пломбой, весом и документами." testId="platform-v7-trip-lifecycle"><P7Section title="Карточка рейса"><article style={cardStyle}><div style={gridStyle}><Metric label="Рейс" value="TR-2041" /><Metric label="Сделка" value="DL-9116" /><Metric label="Заявка" value="LR-2041" /><Metric label="Статус" value="водитель назначен" /></div><div style={mutedStyle}>Следующие действия: прибытие на погрузку, фото, пломба, начало рейса, выгрузка, вес.</div></article></P7Section><P7Section title="Полевые подтверждения"><div style={gridStyle}><article style={cardStyle}><strong>GPS</strong><div style={mutedStyle}>Ожидает первую точку водителя.</div></article><article style={cardStyle}><strong>Фото</strong><div style={mutedStyle}>Ожидает фото погрузки и пломбы.</div></article><article style={cardStyle}><strong>Пломба</strong><div style={mutedStyle}>Ожидает подтверждение номера.</div></article><article style={cardStyle}><strong>Документы</strong><div style={mutedStyle}>ЭТрН, путевой лист, СДИЗ, доверенность.</div></article></div></P7Section></P7Page>;
}
