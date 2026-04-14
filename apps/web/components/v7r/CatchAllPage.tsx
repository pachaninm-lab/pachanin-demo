'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import { AUDIT_LOG, CALLBACKS, DEALS, DISPUTES, RFQ_LIST, getDealById, getDisputeById, type Deal } from '@/lib/v7r/data';
import { classForTone, formatCompactMoney, formatMoney, macroPhase, riskTone, statusLabel } from '@/lib/v7r/helpers';

type NoticeTone = 'danger' | 'warning' | 'success' | 'neutral';

const disputeOwnerLabel: Record<string, string> = {
  seller: 'продавца',
  buyer: 'покупателя',
  lab: 'лаборатории',
  arbitrator: 'арбитра',
};

const callbackTypeLabel: Record<string, string> = {
  Reserve: 'Резерв',
  Mismatch: 'Расхождение',
  Release: 'Выпуск',
};

const reasonLabel: Record<string, string> = {
  MOISTURE_DEVIATION: 'Расхождение по влажности',
  WEIGHT_DEVIATION: 'Расхождение по весу',
};

function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Badge({
  tone,
  children,
}: {
  tone: NoticeTone;
  children: React.ReactNode;
}) {
  const palette = classForTone(tone);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function NoticeBanner({
  tone,
  text,
  onClose,
}: {
  tone: NoticeTone;
  text: string;
  onClose: () => void;
}) {
  const palette = classForTone(tone);
  const Icon = tone === 'danger' ? CircleAlert : tone === 'warning' ? TriangleAlert : CircleCheck;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 14,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
      }}
    >
      <Icon size={16} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{text}</div>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: palette.color, fontWeight: 800 }}
      >
        ×
      </button>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #E4E6EA',
        borderRadius: 18,
        padding: 18,
        boxShadow: '0 8px 24px rgba(9,30,66,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 13, color: '#6B778C', marginTop: 4, lineHeight: 1.6 }}>{subtitle}</div> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  href,
}: {
  title: string;
  value: string;
  subtitle: string;
  href?: string;
}) {
  const body = (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E4E6EA',
        borderRadius: 18,
        padding: 18,
        boxShadow: '0 8px 24px rgba(9,30,66,0.04)',
        minHeight: 116,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B778C' }}>
        {title}
      </div>
      <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', marginTop: 8, lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );

  return href ? (
    <Link href={href} style={{ textDecoration: 'none' }}>
      {body}
    </Link>
  ) : (
    body
  );
}

function Stepper({ status }: { status: string }) {
  const phases = [
    { id: 'contract', label: 'Контракт' },
    { id: 'logistics', label: 'Логистика' },
    { id: 'acceptance', label: 'Приёмка' },
    { id: 'documents', label: 'Документы' },
    { id: 'settlement', label: 'Расчёт' },
  ];
  const current = macroPhase(status);
  const currentIndex = phases.findIndex((phase) => phase.id === current);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {phases.map((phase, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const tone = active ? '#0A7A5F' : done ? '#16A34A' : '#94A3B8';

        return (
          <div
            key={phase.id}
            style={{
              padding: '12px 12px',
              borderRadius: 14,
              border: `1px solid ${active ? 'rgba(10,122,95,0.2)' : done ? 'rgba(22,163,74,0.18)' : '#E4E6EA'}`,
              background: active ? 'rgba(10,122,95,0.08)' : done ? 'rgba(22,163,74,0.08)' : '#F8FAFB',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: tone }}>
              {phase.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventTimeline({ events }: { events: NonNullable<Deal['events']> }) {
  return (
    <div style={{ display: 'grid', gap: 0 }}>
      {events.map((event, index) => (
        <div key={`${event.ts}-${index}`} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: 18 }}>
          {index < events.length - 1 ? (
            <div style={{ position: 'absolute', top: 18, left: 7, bottom: 0, width: 2, background: '#E4E6EA' }} />
          ) : null}
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: event.type === 'danger' ? '#DC2626' : event.type === 'success' ? '#16A34A' : '#64748B',
              marginTop: 2,
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>{event.action}</div>
            <div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>
              {event.actor} · {new Date(event.ts).toLocaleString('ru-RU')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ overflowX: 'auto', borderRadius: 16 }}>{children}</div>;
}

function ActionButton({
  label,
  onClick,
  tone = 'neutral',
  href,
}: {
  label: string;
  onClick?: () => void;
  tone?: NoticeTone;
  href?: string;
}) {
  const styles = {
    neutral: { background: '#FFFFFF', border: '1px solid #E4E6EA', color: '#0F1419' },
    success: { background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#FFFFFF' },
    warning: { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.16)', color: '#B45309' },
    danger: { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.16)', color: '#B91C1C' },
  }[tone];

  const commonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    textDecoration: 'none',
    padding: '10px 12px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ...styles,
  };

  if (href) {
    return (
      <Link href={href} style={commonStyle}>
        {label}
      </Link>
    );
  }

  return (
    <button onClick={onClick} style={commonStyle}>
      {label}
    </button>
  );
}

export function CatchAllPage() {
  const params = useParams<{ slug: string[] }>();
  const slug = params.slug ?? [];
  const {
    role,
    demoMode,
    fieldPreviewRole,
    setFieldPreviewRole,
  } = usePlatformV7RStore();

  const [notice, setNotice] = React.useState<{ text: string; tone: NoticeTone } | null>(null);
  const [ctSearch, setCtSearch] = React.useState('');
  const [ctStatus, setCtStatus] = React.useState('');
  const [ctRisk, setCtRisk] = React.useState('');
  const [dealsSearch, setDealsSearch] = React.useState('');
  const [dealsStatus, setDealsStatus] = React.useState('');
  const [dealsRisk, setDealsRisk] = React.useState('');
  const [sellerMessage, setSellerMessage] = React.useState('');
  const [uploadedDocs, setUploadedDocs] = React.useState<string[]>([]);
  const [sortBy, setSortBy] = React.useState('price_asc');
  const [grainFilter, setGrainFilter] = React.useState('');
  const [shortlist, setShortlist] = React.useState<string[]>(['RFQ-1001', 'RFQ-1003']);
  const [fieldQueue, setFieldQueue] = React.useState<Array<{ id: string; label: string; time: string; status: 'queued' | 'sent' }>>([]);
  const [isOnline, setIsOnline] = React.useState(true);
  const [expandedCallback, setExpandedCallback] = React.useState('CB-442');
  const [complianceSearch, setComplianceSearch] = React.useState('');
  const [complianceActor, setComplianceActor] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [rfqStep, setRfqStep] = React.useState(1);
  const [rfqForm, setRfqForm] = React.useState({
    grain: 'Пшеница 4 кл.',
    volume: '300',
    region: 'Тамбовская обл.',
    payment: 'Банк / резерв',
    quality: 'ГОСТ / влажность ≤14%',
  });

  function pushNotice(text: string, tone: NoticeTone = 'success') {
    setNotice({ text, tone });
  }

  const controlDeals = DEALS.filter((deal) => {
    const q = `${deal.id} ${deal.grain} ${deal.seller.name} ${deal.buyer.name}`.toLowerCase();
    const searchOk = !ctSearch || q.includes(ctSearch.toLowerCase());
    const statusOk = !ctStatus || deal.status === ctStatus;
    const riskOk =
      !ctRisk ||
      (ctRisk === 'high' ? deal.riskScore >= 70 : ctRisk === 'medium' ? deal.riskScore >= 30 && deal.riskScore < 70 : deal.riskScore < 30);

    return searchOk && statusOk && riskOk;
  });

  const dealsFiltered = DEALS.filter((deal) => {
    const q = `${deal.id} ${deal.grain} ${deal.seller.name} ${deal.buyer.name}`.toLowerCase();
    const searchOk = !dealsSearch || q.includes(dealsSearch.toLowerCase());
    const statusOk = !dealsStatus || deal.status === dealsStatus;
    const riskOk =
      !dealsRisk ||
      (dealsRisk === 'high' ? deal.riskScore >= 70 : dealsRisk === 'medium' ? deal.riskScore >= 30 && deal.riskScore < 70 : deal.riskScore < 30);

    return searchOk && statusOk && riskOk;
  });

  const procurementList = [...RFQ_LIST]
    .filter((item) => !grainFilter || item.grain.toLowerCase().includes(grainFilter.toLowerCase()))
    .sort((a, b) =>
      sortBy === 'price_desc'
        ? b.price - a.price
        : sortBy === 'quality'
          ? a.quality.localeCompare(b.quality)
          : sortBy === 'region'
            ? a.region.localeCompare(b.region)
            : a.price - b.price
    );

  const filteredAudit = AUDIT_LOG.filter((entry) => {
    const q = `${entry.actor} ${entry.action} ${entry.object ?? ''}`.toLowerCase();
    const searchOk = !complianceSearch || q.includes(complianceSearch.toLowerCase());
    const actorOk = !complianceActor || entry.actor === complianceActor;
    const fromOk = !dateFrom || entry.ts >= `${dateFrom}T00:00:00Z`;
    const toOk = !dateTo || entry.ts <= `${dateTo}T23:59:59Z`;

    return searchOk && actorOk && fromOk && toOk;
  });

  function simulateUpload(label: string) {
    if (!demoMode) {
      pushNotice('В живом режиме здесь открывается защищённая загрузка документов.', 'warning');
      return;
    }

    setSellerMessage('');
    window.setTimeout(() => {
      setUploadedDocs((prev) => Array.from(new Set([...prev, label])));
      setSellerMessage(`${label} добавлен в демо-контуре.`);
      pushNotice(`${label} добавлен.`, 'success');
    }, 250);
  }

  function pushFieldEvent(label: string) {
    const id = String(Date.now());
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setFieldQueue((prev) => [{ id, label, time, status: isOnline ? 'sent' : 'queued' }, ...prev]);
    pushNotice(isOnline ? 'Событие сразу отправлено в контур.' : 'Событие осталось в офлайн-очереди.', isOnline ? 'success' : 'warning');
  }

  const activeFieldRole =
    role === 'driver' || role === 'surveyor' || role === 'elevator' || role === 'lab'
      ? role
      : fieldPreviewRole;

  const topRisk = [...DEALS].sort((a, b) => b.riskScore - a.riskScore)[0];
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const activeDeals = DEALS.filter((item) => item.status !== 'closed').length;
  const docsBlocked = DEALS.filter((item) => item.blockers.includes('docs')).length;

  function renderControlTower() {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel
          title="Центр управления"
          subtitle="Единый обзор сделок, денег, блокировок, сроков и спорности."
          actions={<ActionButton label="Обновить данные" onClick={() => pushNotice('Данные обновлены.', 'success')} />}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            <KpiCard title="Деньги в контуре" value={formatCompactMoney(totalReserved)} subtitle="Резерв по активным сделкам" href="/platform-v7/deals" />
            <KpiCard title="Под удержанием" value={formatCompactMoney(totalHold)} subtitle="Деньги заморожены до разбора" href="/platform-v7/disputes" />
            <KpiCard title="Документы готовы" value={`${DEALS.length - docsBlocked}/${DEALS.length}`} subtitle="Сделки без документного стоп-фактора" href="/platform-v7/deals" />
            <KpiCard title="Активные сделки" value={String(activeDeals)} subtitle="Все открытые сделки" href="/platform-v7/deals" />
          </div>

          <div
            style={{
              marginTop: 14,
              padding: '14px 16px',
              borderRadius: 16,
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.14)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>Самая рискованная сделка сейчас</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                {topRisk.id} · {topRisk.grain} · риск {topRisk.riskScore}
              </div>
            </div>
            <ActionButton label="Открыть сделку" href={`/platform-v7/deals/${topRisk.id}`} tone="danger" />
          </div>
        </Panel>

        <Panel title="Реестр сделок" subtitle="Быстрый фильтр по статусу, риску и участникам сделки.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input
              placeholder="Поиск по номеру сделки, культуре или стороне..."
              value={ctSearch}
              onChange={(event) => setCtSearch(event.target.value)}
              style={{ flex: 1, minWidth: 230, padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}
            />
            <select value={ctStatus} onChange={(event) => setCtStatus(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}>
              <option value="">Все статусы</option>
              <option value="quality_disputed">Есть спор</option>
              <option value="in_transit">В пути</option>
              <option value="release_requested">Ожидает выпуск</option>
              <option value="closed">Закрыта</option>
            </select>
            <select value={ctRisk} onChange={(event) => setCtRisk(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}>
              <option value="">Все риски</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>

          <TableWrap>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFB' }}>
                  {['Сделка', 'Культура', 'Стороны', 'Статус', 'Резерв', 'Риск', 'Дедлайн', 'Действие'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', padding: 12, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {controlDeals.map((deal) => (
                  <tr key={deal.id} style={{ borderTop: '1px solid #EEF1F3' }}>
                    <td style={{ padding: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                      <Link href={`/platform-v7/deals/${deal.id}`} style={{ color: '#0A7A5F', textDecoration: 'none' }}>
                        {deal.id}
                      </Link>
                    </td>
                    <td style={{ padding: 12 }}>{deal.grain}</td>
                    <td style={{ padding: 12, fontSize: 13 }}>{deal.seller.name} → {deal.buyer.name}</td>
                    <td style={{ padding: 12 }}>
                      <Badge tone={deal.status === 'quality_disputed' ? 'danger' : deal.status === 'in_transit' ? 'warning' : 'success'}>
                        {statusLabel(deal.status)}
                      </Badge>
                    </td>
                    <td style={{ padding: 12, fontWeight: 700 }}>{formatCompactMoney(deal.reservedAmount)}</td>
                    <td style={{ padding: 12 }}>
                      <Badge tone={riskTone(deal.riskScore)}>{deal.riskScore}</Badge>
                    </td>
                    <td style={{ padding: 12, fontSize: 12 }}>{deal.slaDeadline ?? '—'}</td>
                    <td style={{ padding: 12 }}>
                      <ActionButton label="Открыть" href={`/platform-v7/deals/${deal.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </div>
    );
  }

  function renderDealsList() {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel title="Сделки" subtitle="Все сделки с быстрым переходом в карточку и денежный контур.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input
              placeholder="Поиск по сделке, культуре, продавцу или покупателю..."
              value={dealsSearch}
              onChange={(event) => setDealsSearch(event.target.value)}
              style={{ flex: 1, minWidth: 230, padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}
            />
            <select value={dealsStatus} onChange={(event) => setDealsStatus(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}>
              <option value="">Все статусы</option>
              <option value="quality_disputed">Есть спор</option>
              <option value="in_transit">В пути</option>
              <option value="release_requested">Ожидает выпуск</option>
              <option value="closed">Закрыта</option>
            </select>
            <select value={dealsRisk} onChange={(event) => setDealsRisk(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}>
              <option value="">Все риски</option>
              <option value="high">Высокий</option>
              <option value="medium">Средний</option>
              <option value="low">Низкий</option>
            </select>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {dealsFiltered.map((deal) => (
              <Link
                key={deal.id}
                href={`/platform-v7/deals/${deal.id}`}
                style={{
                  textDecoration: 'none',
                  background: '#FFFFFF',
                  border: '1px solid #E4E6EA',
                  borderRadius: 16,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F' }}>{deal.id}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                    {deal.grain} · {deal.quantity} {deal.unit}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#0F1419' }}>{deal.seller.name} → {deal.buyer.name}</div>
                <div>
                  <Badge tone={deal.status === 'quality_disputed' ? 'danger' : deal.status === 'in_transit' ? 'warning' : 'success'}>
                    {statusLabel(deal.status)}
                  </Badge>
                </div>
                <div style={{ fontWeight: 700, color: '#0F1419' }}>{formatCompactMoney(deal.reservedAmount)}</div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderDealDetail(id: string) {
    const deal = getDealById(id);

    if (!deal) {
      return (
        <Panel title="Сделка не найдена" subtitle={`Сделка ${id} не существует или недоступна.`}>
          <ActionButton label="Вернуться к списку" href="/platform-v7/deals" />
        </Panel>
      );
    }

    const actions: Record<string, Array<{ label: string; href?: string; tone?: NoticeTone; message?: string }>> = {
      payment_reserved: [{ label: 'Поставить погрузку в график', message: `Для ${deal.id} создано задание на погрузку.` }],
      in_transit: [{ label: 'Открыть маршрут', message: `Открыт маршрут по сделке ${deal.id}.` }],
      quality_disputed: [
        { label: 'Открыть спор', href: `/platform-v7/disputes/${deal.dispute?.id ?? ''}`, tone: 'danger' },
        { label: 'Предложить частичный выпуск', tone: 'warning', message: `По ${deal.id} отправлено предложение частичного выпуска.` },
      ],
      docs_complete: [{ label: 'Запросить выпуск денег', tone: 'success', message: `По ${deal.id} отправлен запрос на выпуск.` }],
      release_requested: [{ label: 'Подтвердить выпуск', tone: 'success', message: `По ${deal.id} выпуск подтверждён в демо-контуре.` }],
    };

    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel
          title={deal.id}
          subtitle={`${deal.grain} · ${deal.quantity} ${deal.unit} · ${deal.seller.name} → ${deal.buyer.name}`}
          actions={<ActionButton label="Все сделки" href="/platform-v7/deals" />}
        >
          <Stepper status={deal.status} />
        </Panel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Резерв" value={formatCompactMoney(deal.reservedAmount)} subtitle="Под контролем банка" />
          <KpiCard title="Удержание" value={formatCompactMoney(deal.holdAmount)} subtitle={deal.holdAmount > 0 ? 'Деньги заморожены до решения' : 'Удержаний нет'} />
          <KpiCard title="К выпуску" value={formatCompactMoney(deal.releaseAmount ?? Math.round(deal.reservedAmount * 0.7))} subtitle="Сумма к перечислению после подтверждений" />
          <KpiCard title="Риск" value={String(deal.riskScore)} subtitle={statusLabel(deal.status)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Panel title="Деньги по сделке" subtitle="Разбивка суммы, удержаний и ожидаемого выпуска.">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>Стоимость партии</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700 }}>
                    {formatMoney(deal.totalAmount ?? Math.round(deal.quantity * (deal.pricePerTon ?? 14800)))}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>Зарезервировано</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700, color: '#0A7A5F' }}>
                    {formatMoney(deal.reservedAmount)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>Под удержанием</td>
                  <td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>
                    − {formatMoney(deal.holdAmount)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 0', fontWeight: 800 }}>К выплате</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, color: '#15803D' }}>
                    {formatMoney(deal.releaseAmount ?? Math.round(deal.reservedAmount * 0.7))}
                  </td>
                </tr>
              </tbody>
            </table>
          </Panel>

          <Panel title="Следующее логичное действие" subtitle="Система не показывает лишнего. Только то, что помогает двигать сделку дальше.">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(actions[deal.status] ?? [{ label: 'Открыть сделку в операционном контуре', message: `Карточка сделки ${deal.id} открыта.` }]).map((action) =>
                action.href ? (
                  <ActionButton key={action.label} label={action.label} href={action.href} tone={action.tone ?? 'neutral'} />
                ) : (
                  <ActionButton
                    key={action.label}
                    label={action.label}
                    onClick={() => pushNotice(action.message ?? 'Действие выполнено.', action.tone ?? 'success')}
                    tone={action.tone ?? 'neutral'}
                  />
                )
              )}
            </div>
          </Panel>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Panel title="Маршрут и физическое движение" subtitle="События от хозяйства до точки приёмки.">
            {deal.route?.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {deal.route.map((item, index) => (
                  <div key={`${item.time}-${index}`} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 10, paddingBottom: 10, borderBottom: index < deal.route!.length - 1 ? '1px solid #F1F3F5' : 'none' }}>
                    <div style={{ fontSize: 12, color: '#6B778C' }}>{item.time}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{item.event}</div>
                      <div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>
                        {[item.gps, item.driver].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#6B778C' }}>Маршрут по этой сделке ещё не сформирован.</div>
            )}
          </Panel>

          <Panel title="История событий" subtitle="Факты, которые уже попали в контур сделки.">
            {deal.events?.length ? <EventTimeline events={deal.events} /> : <div style={{ fontSize: 13, color: '#6B778C' }}>Событий пока нет.</div>}
          </Panel>
        </div>
      </div>
    );
  }

  function renderSeller() {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel title="Кабинет продавца" subtitle="Где деньги, что мешает выплате и какие документы ещё нужны.">
          <div
            style={{
              padding: '18px 18px',
              borderRadius: 18,
              background: 'linear-gradient(180deg, rgba(10,122,95,0.08) 0%, rgba(255,255,255,0.9) 100%)',
              border: '1px solid rgba(10,122,95,0.14)',
            }}
          >
            <div style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
              Ближайшая выплата
            </div>
            <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>4 368 000 ₽</div>
            <div style={{ fontSize: 13, color: '#15803D', marginTop: 8 }}>После закрытия спора и проверки акта сумма будет выпущена.</div>
            <div style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 13, color: '#334155' }}>
              <div>✓ Контракт подписан</div>
              <div>✓ Резерв подтверждён банком</div>
              <div>✓ Груз принят на элеваторе</div>
              <div>• Нужен акт приёмки</div>
              <div>• Нужно закрыть спор по качеству</div>
            </div>
          </div>
        </Panel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Получите на счёт" value="6,2 млн ₽" subtitle="Все ожидаемые выплаты" />
          <KpiCard title="Задержано из-за спора" value="624 тыс. ₽" subtitle="Сделка DL-9102 под удержанием" />
          <KpiCard title="Что мешает выплате" value="2" subtitle="Открытый спор и незагруженный акт" />
          <KpiCard title="Активные сделки" value="6" subtitle="Текущий портфель продавца" />
        </div>

        <Panel title="Нужны документы" subtitle="В демо-контуре загрузка имитируется, в живом — ведёт в защищённое хранилище.">
          {sellerMessage ? (
            <div style={{ marginBottom: 12 }}>
              <NoticeBanner tone="success" text={sellerMessage} onClose={() => setSellerMessage('')} />
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 10 }}>
            {['Акт приёмки', 'Форма ЗТТ', 'Сертификат качества', 'Протокол разгрузки'].map((label) => (
              <div
                key={label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '12px 0',
                  borderTop: '1px solid #F1F3F5',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                    {uploadedDocs.includes(label) ? 'Документ уже добавлен в контур сделки.' : 'После загрузки документ станет доступен банку и оператору.'}
                  </div>
                </div>
                <ActionButton label={uploadedDocs.includes(label) ? 'Добавлен' : 'Загрузить'} onClick={() => simulateUpload(label)} tone={uploadedDocs.includes(label) ? 'success' : 'neutral'} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderBuyer() {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Бюджет в резерве" value="6,2 млн ₽" subtitle="Деньги уже заведены в контур" />
          <KpiCard title="Под удержанием" value="624 тыс. ₽" subtitle="Открытый спор по качеству" />
          <KpiCard title="Спорные сделки" value="2" subtitle="Нужно решение по качеству и весу" />
          <KpiCard title="Активные закупки" value="6" subtitle="Текущий портфель покупателя" />
        </div>

        <Panel
          title="Кабинет покупателя"
          subtitle="Отбор предложений, контроль качества и решение по выпуску денег."
          actions={<ActionButton label="Открыть проблемную сделку" href="/platform-v7/deals/DL-9102" tone="danger" />}
        >
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.14)',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>Есть лабораторное расхождение по DL-9102</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
              Нужно открыть сделку, сверить качество и решить вопрос с частичным выпуском денег.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}>
              <option value="price_asc">Цена: от низкой</option>
              <option value="price_desc">Цена: от высокой</option>
              <option value="quality">По качеству</option>
              <option value="region">По региону</option>
            </select>
            <select value={grainFilter} onChange={(event) => setGrainFilter(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}>
              <option value="">Все культуры</option>
              <option value="Пшеница 3">Пшеница 3 кл.</option>
              <option value="Пшеница 4">Пшеница 4 кл.</option>
              <option value="Кукуруза">Кукуруза</option>
              <option value="Ячмень">Ячмень</option>
            </select>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {procurementList.map((item) => {
              const inShortlist = shortlist.includes(item.id);

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E4E6EA',
                    borderRadius: 16,
                    padding: 16,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{item.grain}</div>
                    <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                      {item.volume} т · {item.region} · {item.quality}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(item.price)} / т</div>
                  <div style={{ fontSize: 12, color: '#6B778C' }}>{item.payment}</div>
                  <ActionButton
                    label={inShortlist ? 'Уже отобрано' : 'Добавить в отбор'}
                    tone={inShortlist ? 'success' : 'neutral'}
                    onClick={() => {
                      setShortlist((prev) => (inShortlist ? prev.filter((entry) => entry !== item.id) : [...prev, item.id]));
                      pushNotice(
                        inShortlist ? `${item.id} убран из отбора.` : `${item.id} добавлен в отбор.`,
                        inShortlist ? 'warning' : 'success'
                      );
                    }}
                  />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    );
  }

  function renderLogistics() {
    const rows = [
      { route: 'Маршрут ТМБ-14', status: 'В пути', eta: '14:30', risk: 'Маршрут без отклонений', href: '/platform-v7/deals/DL-9102' },
      { route: 'Маршрут ВРЖ-08', status: 'Ожидание погрузки', eta: '16:10', risk: 'Требуется подтверждение склада', href: '/platform-v7/deals/DL-9106' },
      { route: 'Маршрут КРС-03', status: 'На приёмке', eta: 'сейчас', risk: 'Идёт разгрузка на элеваторе', href: '/platform-v7/deals/DL-9103' },
    ];

    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Машины в рейсе" value="12" subtitle="Активный парк по открытым сделкам" />
          <KpiCard title="Ожидают приёмку" value="3" subtitle="Очередь на элеваторе и разгрузке" />
          <KpiCard title="Отклонения маршрута" value="1" subtitle="Требует внимания диспетчера" />
          <KpiCard title="Средний ETA" value="1 ч 24 мин" subtitle="До ближайшей точки прибытия" />
        </div>

        <Panel title="Логистика" subtitle="Диспетчерская по рейсам, очередям, ETA и проблемным точкам.">
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((row) => (
              <div
                key={row.route}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E6EA',
                  borderRadius: 16,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{row.route}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{row.risk}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{row.status}</div>
                <div style={{ fontSize: 13, color: '#0F1419' }}>ETA: {row.eta}</div>
                <ActionButton label="Открыть связанную сделку" href={row.href} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderField() {
    const fieldRoleLabels: Record<string, string> = {
      driver: 'Водитель',
      surveyor: 'Сюрвейер',
      elevator: 'Элеватор',
      lab: 'Лаборатория',
    };

    const actionLabel =
      activeFieldRole === 'driver'
        ? 'Подтвердить прибытие машины'
        : activeFieldRole === 'surveyor'
          ? 'Подтвердить взвешивание и фотофиксацию'
          : activeFieldRole === 'elevator'
            ? 'Подтвердить разгрузку'
            : 'Опубликовать протокол качества';

    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel title="Поле и приёмка" subtitle="Один экран для водителя, сюрвейера, элеватора и лаборатории.">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['driver', 'surveyor', 'elevator', 'lab'] as const).map((fieldRole) => (
              <button
                key={fieldRole}
                onClick={() => setFieldPreviewRole(fieldRole)}
                style={{
                  border: activeFieldRole === fieldRole ? '1px solid rgba(10,122,95,0.16)' : '1px solid #E4E6EA',
                  background: activeFieldRole === fieldRole ? 'rgba(10,122,95,0.08)' : '#FFFFFF',
                  color: activeFieldRole === fieldRole ? '#0A7A5F' : '#0F1419',
                  borderRadius: 999,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {fieldRoleLabels[fieldRole]}
              </button>
            ))}
          </div>
        </Panel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Panel title="Маршрут" subtitle="Короткая логика движения, текущая точка и ожидаемое прибытие.">
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#16A34A' }} />
                <div style={{ fontSize: 13 }}>Хозяйство Ковалёв · старт погрузки</div>
              </div>
              <div style={{ width: 2, height: 22, background: '#E4E6EA', marginLeft: 4 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0A7A5F' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0A7A5F' }}>Текущая точка · 51.2934, 37.2185</div>
              </div>
              <div style={{ width: 2, height: 22, background: '#E4E6EA', marginLeft: 4 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#CBD5E1' }} />
                <div style={{ fontSize: 13, color: '#475569' }}>Элеватор Чернозёмный · ETA 14:30</div>
              </div>
            </div>
          </Panel>

          <Panel title="Следующее действие" subtitle={`Роль: ${fieldRoleLabels[activeFieldRole]}. Система показывает ровно один ожидаемый шаг.`}>
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: 'rgba(10,122,95,0.08)',
                border: '1px solid rgba(10,122,95,0.14)',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>{actionLabel}</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 8 }}>
                Подтверждение уходит в контур сделки и становится основанием для следующего этапа.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <ActionButton label="Выполнить шаг" onClick={() => pushFieldEvent(actionLabel)} tone="success" />
                <ActionButton label={isOnline ? 'Перейти офлайн' : 'Вернуться онлайн'} onClick={() => setIsOnline((prev) => !prev)} tone="neutral" />
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Офлайн-очередь" subtitle="Если сеть пропала, события не теряются и ждут отправки.">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <Badge tone={isOnline ? 'success' : 'warning'}>{isOnline ? 'Связь есть' : 'Нет связи'}</Badge>
            <div style={{ fontSize: 12, color: '#6B778C' }}>Накоплено событий: {fieldQueue.length}</div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {fieldQueue.length === 0 ? (
              <div style={{ fontSize: 13, color: '#6B778C' }}>Очередь пока пуста.</div>
            ) : (
              fieldQueue.map((item) => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, padding: '10px 0', borderTop: '1px solid #F1F3F5', alignItems: 'center' }}>
                  <span style={{ fontSize: 16 }}>{item.status === 'sent' ? '✓' : '⏳'}</span>
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: '#6B778C' }}>{item.time}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    );
  }

  function renderBank() {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Резерв" value="6,24 млн ₽" subtitle="Деньги подтверждены и заведены в контур" />
          <KpiCard title="Под удержанием" value="624 тыс. ₽" subtitle="Спор DK-2024-89" />
          <KpiCard title="К выпуску" value="5,76 млн ₽" subtitle="После закрытия блокеров" />
          <KpiCard title="Расхождения" value="1" subtitle="Есть ручная банковая проверка" />
        </div>

        <Panel title="Банковый контур" subtitle="Резерв, удержание, выпуск и ручной разбор расхождений.">
          <div style={{ display: 'grid', gap: 10 }}>
            {CALLBACKS.map((callback) => (
              <div
                key={callback.id}
                style={{
                  background: callback.status === 'mismatch' ? 'rgba(220,38,38,0.04)' : '#FFFFFF',
                  border: `1px solid ${callback.status === 'mismatch' ? 'rgba(220,38,38,0.16)' : '#E4E6EA'}`,
                  borderRadius: 16,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                      {callback.id} · {callbackTypeLabel[callback.type] ?? callback.type} · {callback.dealId}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{callback.note}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {callback.status === 'mismatch' ? (
                      <ActionButton
                        label={expandedCallback === callback.id ? 'Скрыть детали' : 'Показать детали'}
                        onClick={() => setExpandedCallback(expandedCallback === callback.id ? '' : callback.id)}
                        tone="danger"
                      />
                    ) : null}
                    <ActionButton label="Открыть связанный объект" href={callback.status === 'mismatch' ? '/platform-v7/disputes/DK-2024-89' : `/platform-v7/deals/${callback.dealId}`} />
                  </div>
                </div>

                {callback.id === 'CB-442' && expandedCallback === 'CB-442' ? (
                  <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#B91C1C' }}>
                      4 дня без закрытия ручной проверки
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.65, marginTop: 8 }}>
                      Есть расхождение протеина между паспортом партии и лабораторным протоколом. Банк держит выплату, пока спор не будет
                      урегулирован и пакет доказательств не станет полным.
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <ActionButton label="Эскалировать в банк" onClick={() => pushNotice('Эскалация отправлена в банковый контур.', 'warning')} tone="danger" />
                      <ActionButton label="Открыть спор" href="/platform-v7/disputes/DK-2024-89" />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderDisputes() {
    const totalDisputeHold = DISPUTES.reduce((sum, item) => sum + item.holdAmount, 0);
    const urgent = DISPUTES.filter((item) => item.slaDaysLeft <= 1).length;

    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Активные споры" value={String(DISPUTES.length)} subtitle="Комнаты разбора по проблемным сделкам" />
          <KpiCard title="Под удержанием" value={formatCompactMoney(totalDisputeHold)} subtitle="Сумма замороженных денег" />
          <KpiCard title="Дедлайн сегодня" value={String(urgent)} subtitle="Требует немедленной реакции" />
        </div>

        <Panel title="Споры" subtitle="Кто владеет следующим шагом, сколько денег под удержанием и насколько полон пакет доказательств.">
          <TableWrap>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFB' }}>
                  {['Спор', 'Сделка', 'Причина', 'Удержание', 'Дедлайн', 'У кого следующий шаг', 'Пакет доказательств'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', padding: 12, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISPUTES.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #EEF1F3' }}>
                    <td style={{ padding: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800 }}>
                      <Link href={`/platform-v7/disputes/${item.id}`} style={{ color: '#0A7A5F', textDecoration: 'none' }}>
                        {item.id}
                      </Link>
                    </td>
                    <td style={{ padding: 12 }}>{item.dealId}</td>
                    <td style={{ padding: 12 }}>
                      <Badge tone="warning">{reasonLabel[item.reasonCode] ?? item.reasonCode}</Badge>
                    </td>
                    <td style={{ padding: 12, fontWeight: 700, color: '#B91C1C' }}>{formatCompactMoney(item.holdAmount)}</td>
                    <td style={{ padding: 12 }}>{item.slaDaysLeft} дн.</td>
                    <td style={{ padding: 12 }}>{disputeOwnerLabel[item.ballAt] ?? item.ballAt}</td>
                    <td style={{ padding: 12 }}>
                      {item.evidence.uploaded}/{item.evidence.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </div>
    );
  }

  function renderDisputeDetail(id: string) {
    const dispute = getDisputeById(id);

    if (!dispute) {
      return (
        <Panel title="Спор не найден" subtitle={`Спор ${id} не существует или недоступен.`}>
          <ActionButton label="Вернуться к списку" href="/platform-v7/disputes" />
        </Panel>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel
          title={`${dispute.id} · ${dispute.title}`}
          subtitle={dispute.description}
          actions={<ActionButton label="Все споры" href="/platform-v7/disputes" />}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: '14px 16px',
              borderRadius: 16,
              background: 'rgba(217,119,6,0.08)',
              border: '1px solid rgba(217,119,6,0.16)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: '#B45309' }}>
              У кого следующий шаг: {disputeOwnerLabel[dispute.ballAt] ?? dispute.ballAt}
            </div>
            <ActionButton label="Отправить напоминание" onClick={() => pushNotice('Уведомление отправлено участнику спора.', 'warning')} tone="warning" />
          </div>
        </Panel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Сделка" value={dispute.dealId} subtitle="Связанный объект" />
          <KpiCard title="Удержание" value={formatCompactMoney(dispute.holdAmount)} subtitle="Сумма заморожена до решения" />
          <KpiCard title="Дедлайн" value={`${dispute.slaDaysLeft} дн.`} subtitle="Сколько осталось на разбор" />
          <KpiCard title="Пакет доказательств" value={`${dispute.evidence.uploaded}/${dispute.evidence.total}`} subtitle="Степень готовности к решению" />
        </div>

        <Panel title="Действия по спору" subtitle="Пакет доказательств и быстрый переход в связанную сделку.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionButton
              label="Сформировать пакет доказательств"
              onClick={() =>
                downloadFile(
                  `evidence-pack-${dispute.id}.txt`,
                  `Пакет доказательств\nСпор: ${dispute.id}\nСделка: ${dispute.dealId}\nПричина: ${reasonLabel[dispute.reasonCode] ?? dispute.reasonCode}\nУдержание: ${dispute.holdAmount}\nПакет: ${dispute.evidence.uploaded}/${dispute.evidence.total}`
                )
              }
            />
            <ActionButton label="Открыть сделку" href={`/platform-v7/deals/${dispute.dealId}`} />
          </div>
        </Panel>
      </div>
    );
  }

  function renderCompliance() {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel
          title="Комплаенс и журнал действий"
          subtitle="Поиск по актору, периоду и объекту с выгрузкой в CSV."
          actions={
            <ActionButton
              label="Выгрузить CSV"
              onClick={() =>
                downloadFile(
                  `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
                  ['Время,Актор,Действие,Тип,Объект', ...filteredAudit.map((entry) => `${entry.ts},${entry.actor},${entry.action},${entry.type},${entry.object ?? ''}`)].join('\n'),
                  'text/csv;charset=utf-8'
                )
              }
            />
          }
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input
              placeholder="Поиск по действию, актору или объекту..."
              value={complianceSearch}
              onChange={(event) => setComplianceSearch(event.target.value)}
              style={{ flex: 1, minWidth: 220, padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}
            />
            <select value={complianceActor} onChange={(event) => setComplianceActor(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}>
              <option value="">Все акторы</option>
              {Array.from(new Set(AUDIT_LOG.map((entry) => entry.actor))).map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </select>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
          </div>

          <TableWrap>
            <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFB' }}>
                  {['Время', 'Актор', 'Действие', 'Тип', 'Объект'].map((label) => (
                    <th key={label} style={{ textAlign: 'left', padding: 12, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((entry, index) => (
                  <tr key={`${entry.ts}-${index}`} style={{ borderTop: '1px solid #EEF1F3' }}>
                    <td style={{ padding: 12, fontSize: 12 }}>{new Date(entry.ts).toLocaleString('ru-RU')}</td>
                    <td style={{ padding: 12 }}>{entry.actor}</td>
                    <td style={{ padding: 12 }}>{entry.action}</td>
                    <td style={{ padding: 12 }}>
                      <Badge tone={entry.type === 'danger' ? 'danger' : entry.type === 'warning' ? 'warning' : 'success'}>{entry.type}</Badge>
                    </td>
                    <td style={{ padding: 12 }}>{entry.object ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </div>
    );
  }

  function renderProcurement() {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <Panel title="Закупки" subtitle="Пошаговое создание запроса на закупку и список активных запросов.">
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#F8FAFB',
              border: '1px solid #E4E6EA',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, color: '#6B778C' }}>
              Шаг {rfqStep} из 4
            </div>

            {rfqStep === 1 ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <input value={rfqForm.grain} onChange={(event) => setRfqForm({ ...rfqForm, grain: event.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
                <input value={rfqForm.volume} onChange={(event) => setRfqForm({ ...rfqForm, volume: event.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
              </div>
            ) : null}

            {rfqStep === 2 ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <input value={rfqForm.region} onChange={(event) => setRfqForm({ ...rfqForm, region: event.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
                <input value={rfqForm.payment} onChange={(event) => setRfqForm({ ...rfqForm, payment: event.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
              </div>
            ) : null}

            {rfqStep === 3 ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <input value={rfqForm.quality} onChange={(event) => setRfqForm({ ...rfqForm, quality: event.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
              </div>
            ) : null}

            {rfqStep === 4 ? (
              <div style={{ marginTop: 12, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                {rfqForm.grain} · {rfqForm.volume} т · {rfqForm.region} · {rfqForm.payment} · {rfqForm.quality}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <ActionButton label="Назад" onClick={() => setRfqStep((prev) => Math.max(1, prev - 1))} />
              <ActionButton
                label={rfqStep < 4 ? 'Далее' : 'Сохранить'}
                tone="success"
                onClick={() => {
                  if (rfqStep < 4) {
                    setRfqStep((prev) => prev + 1);
                  } else {
                    pushNotice('Запрос на закупку сохранён в демо-контуре.', 'success');
                  }
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {RFQ_LIST.map((rfq) => (
              <div
                key={rfq.id}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E6EA',
                  borderRadius: 16,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{rfq.id} · {rfq.grain}</div>
                  <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>
                    {rfq.volume} т · {rfq.region}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(rfq.price)} / т</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{rfq.quality}</div>
                <ActionButton label="Подать предложение" onClick={() => pushNotice(`По ${rfq.id} добавлено предложение.`, 'success')} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  function renderAnalytics() {
    const months = [
      { month: 'Янв', count: 12, volume: 45000000 },
      { month: 'Фев', count: 18, volume: 67000000 },
      { month: 'Мар', count: 24, volume: 91000000 },
      { month: 'Апр', count: 31, volume: 118000000 },
    ];
    const maxCount = Math.max(...months.map((item) => item.count));
    const maxVolume = Math.max(...months.map((item) => item.volume));

    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <KpiCard title="Спорность" value="8%" subtitle="Доля сделок, где включилось удержание" />
          <KpiCard title="Средний чек" value="4,2 млн ₽" subtitle="Средний размер сделки" />
          <KpiCard title="Скорость закрытия" value="8,3 дня" subtitle="Среднее время от сделки до расчёта" />
          <KpiCard title="Сделок в апреле" value="31" subtitle="Пик по текущему ряду" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Panel title="Сделки по месяцам" subtitle="Сколько сделок прошло через контур.">
            <div style={{ display: 'flex', alignItems: 'end', gap: 12, height: 220 }}>
              {months.map((item) => (
                <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{item.count}</div>
                  <div style={{ width: 42, height: `${Math.max(20, (item.count / maxCount) * 150)}px`, borderRadius: 10, background: '#0A7A5F' }} />
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{item.month}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Оборот по месяцам" subtitle="Деньги, которые прошли через платформенный контур.">
            <div style={{ display: 'flex', alignItems: 'end', gap: 12, height: 220 }}>
              {months.map((item) => (
                <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{Math.round(item.volume / 1000000)} млн</div>
                  <div style={{ width: 42, height: `${Math.max(20, (item.volume / maxVolume) * 150)}px`, borderRadius: 10, background: '#64748B' }} />
                  <div style={{ fontSize: 11, color: '#6B778C' }}>{item.month}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  const first = slug[0];

  if (!first) return null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {notice ? <NoticeBanner tone={notice.tone} text={notice.text} onClose={() => setNotice(null)} /> : null}

      {first === 'control-tower' ? renderControlTower() : null}
      {first === 'deals' && slug.length === 1 ? renderDealsList() : null}
      {first === 'deals' && slug[1] ? renderDealDetail(slug[1]) : null}
      {first === 'seller' ? renderSeller() : null}
      {first === 'buyer' ? renderBuyer() : null}
      {first === 'logistics' ? renderLogistics() : null}
      {first === 'field' ? renderField() : null}
      {first === 'bank' ? renderBank() : null}
      {first === 'disputes' && slug.length === 1 ? renderDisputes() : null}
      {first === 'disputes' && slug[1] ? renderDisputeDetail(slug[1]) : null}
      {first === 'compliance' ? renderCompliance() : null}
      {first === 'procurement' ? renderProcurement() : null}
      {first === 'analytics' ? renderAnalytics() : null}

      {!['control-tower', 'deals', 'seller', 'buyer', 'logistics', 'field', 'bank', 'disputes', 'compliance', 'procurement', 'analytics'].includes(first) ? (
        <Panel title="Экран не найден" subtitle="Такого маршрута пока нет в демо-контуре.">
          <ActionButton label="Открыть центр управления" href="/platform-v7/control-tower" />
        </Panel>
      ) : null}
    </div>
  );
}
