'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import { DEALS, DISPUTES, CALLBACKS, AUDIT_LOG, RFQ_LIST, getDealById, getDisputeById, type Deal } from '@/lib/v7r/data';
import { formatMoney, formatCompactMoney, statusLabel, riskTone, classForTone, macroPhase } from '@/lib/v7r/helpers';

function downloadFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Badge({ tone, children }: { tone: 'danger' | 'warning' | 'success' | 'neutral'; children: React.ReactNode }) {
  const s = classForTone(tone);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 700 }}>{children}</span>;
}

function KpiCard({ title, value, sub, href }: { title: string; value: string; sub: string; href?: string }) {
  const body = (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18, boxShadow: '0 6px 18px rgba(9,30,66,0.04)' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', marginTop: 6 }}>{sub}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{body}</Link> : body;
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return <div style={{ marginBottom: 14 }}><div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{title}</div>{sub ? <div style={{ fontSize: 13, color: '#6B778C', marginTop: 4 }}>{sub}</div> : null}</div>;
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
  const currentIndex = phases.findIndex((p) => p.id === current);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
      {phases.map((phase, idx) => {
        const done = idx < currentIndex;
        const active = idx === currentIndex;
        return (
          <div key={phase.id} style={{ padding: '12px 10px', borderRadius: 10, background: active ? 'rgba(10,122,95,0.08)' : done ? 'rgba(22,163,74,0.08)' : '#F4F5F7', border: `1px solid ${active ? 'rgba(10,122,95,0.2)' : done ? 'rgba(22,163,74,0.2)' : '#E4E6EA'}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: active ? '#0A7A5F' : done ? '#16A34A' : '#6B778C', textTransform: 'uppercase' }}>{phase.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function EventTimeline({ events }: { events: NonNullable<Deal['events']> }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{events.map((event, index) => (<div key={index} style={{ display: 'flex', gap: 12, paddingBottom: 18, position: 'relative' }}>{index < events.length - 1 ? <div style={{ position: 'absolute', left: 7, top: 18, bottom: 0, width: 2, background: '#E4E6EA' }} /> : null}<div style={{ width: 16, height: 16, borderRadius: '50%', marginTop: 2, background: event.type === 'danger' ? '#DC2626' : event.type === 'success' ? '#16A34A' : '#6B778C', flexShrink: 0 }} /><div><div style={{ fontSize: 13, fontWeight: 600 }}>{event.action}</div><div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>{event.actor} · {new Date(event.ts).toLocaleString('ru-RU')}</div></div></div>))}</div>;
}

export default function PlatformV7RCatchAllPage() {
  const params = useParams<{ slug: string[] }>();
  const slug = params.slug ?? [];
  const { role, demoMode, fieldPreviewRole, setFieldPreviewRole } = usePlatformV7RStore();

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
  const [shortlist, setShortlist] = React.useState<string[]>(['DL-9104', 'DL-9107']);
  const [fieldQueue, setFieldQueue] = React.useState<Array<{ id: string; label: string; time: string; status: 'queued' | 'sent' }>>([]);
  const [isOnline, setIsOnline] = React.useState(true);
  const [expandedCallback, setExpandedCallback] = React.useState('CB-442');
  const [complianceSearch, setComplianceSearch] = React.useState('');
  const [complianceActor, setComplianceActor] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [rfqStep, setRfqStep] = React.useState(1);
  const [rfqForm, setRfqForm] = React.useState({ grain: 'Пшеница 4 кл.', volume: '300', region: 'Тамбовская обл.', payment: 'Сбер / резерв', quality: 'ГОСТ / влажность ≤14%' });

  const controlDeals = DEALS.filter((deal) => {
    const q = `${deal.id} ${deal.grain} ${deal.seller.name} ${deal.buyer.name}`.toLowerCase();
    const searchOk = !ctSearch || q.includes(ctSearch.toLowerCase());
    const statusOk = !ctStatus || deal.status === ctStatus;
    const riskOk = !ctRisk || (ctRisk === 'high' ? deal.riskScore >= 70 : ctRisk === 'medium' ? deal.riskScore >= 30 && deal.riskScore < 70 : deal.riskScore < 30);
    return searchOk && statusOk && riskOk;
  });

  const dealsFiltered = DEALS.filter((deal) => {
    const q = `${deal.id} ${deal.grain} ${deal.seller.name} ${deal.buyer.name}`.toLowerCase();
    const searchOk = !dealsSearch || q.includes(dealsSearch.toLowerCase());
    const statusOk = !dealsStatus || deal.status === dealsStatus;
    const riskOk = !dealsRisk || (dealsRisk === 'high' ? deal.riskScore >= 70 : dealsRisk === 'medium' ? deal.riskScore >= 30 && deal.riskScore < 70 : deal.riskScore < 30);
    return searchOk && statusOk && riskOk;
  });

  const procurementList = [...RFQ_LIST].filter((item) => !grainFilter || item.grain.toLowerCase().includes(grainFilter.toLowerCase())).sort((a, b) => sortBy === 'price_desc' ? b.price - a.price : sortBy === 'quality' ? a.quality.localeCompare(b.quality) : sortBy === 'region' ? a.region.localeCompare(b.region) : a.price - b.price);

  const filteredAudit = AUDIT_LOG.filter((entry) => {
    const q = `${entry.actor} ${entry.action} ${entry.object ?? ''}`.toLowerCase();
    const searchOk = !complianceSearch || q.includes(complianceSearch.toLowerCase());
    const actorOk = !complianceActor || entry.actor === complianceActor;
    const fromOk = !dateFrom || entry.ts >= `${dateFrom}T00:00:00Z`;
    const toOk = !dateTo || entry.ts <= `${dateTo}T23:59:59Z`;
    return searchOk && actorOk && fromOk && toOk;
  });

  function simulateUpload(label: string) {
    setSellerMessage('');
    setTimeout(() => {
      setUploadedDocs((prev) => Array.from(new Set([...prev, label])));
      setSellerMessage(`${label} загружен (SANDBOX)`);
    }, 800);
  }

  function pushFieldEvent(label: string) {
    const id = `${Date.now()}`;
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setFieldQueue((prev) => [{ id, label, time, status: 'queued' }, ...prev]);
    setTimeout(() => {
      setFieldQueue((prev) => prev.map((item) => item.id === id ? { ...item, status: isOnline ? 'sent' : 'queued' } : item));
    }, 500);
  }

  function renderControlTower() {
    const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
    const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
    const activeDeals = DEALS.filter((item) => item.status !== 'closed').length;
    const docsBlocked = DEALS.filter((item) => item.blockers.includes('docs')).length;
    const topRisk = [...DEALS].sort((a, b) => b.riskScore - a.riskScore)[0];
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Control Tower" sub="Единый обзор исполнения сделок, денег и спорности." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard title="Деньги под контролем" value={formatCompactMoney(totalReserved)} sub="Общий резерв по активным сделкам" href="/platform-v7/deals" />
        <KpiCard title="Риск под hold" value={formatCompactMoney(totalHold)} sub="Сумма под удержанием" href="/platform-v7/deals?status=quality_disputed" />
        <KpiCard title="Документов готово" value={`${DEALS.length - docsBlocked}/${DEALS.length}`} sub="Сделки без docs-blocker" href="/platform-v7/deals?blocker=docs" />
        <KpiCard title="Активных сделок" value={String(activeDeals)} sub="Все рабочие сделки" href="/platform-v7/deals" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10 }}>
        <div style={{ fontWeight: 800, color: '#DC2626' }}>Наивысший риск</div>
        <div style={{ flex: 1, fontSize: 13 }}>{topRisk.id} · {topRisk.grain} · Risk {topRisk.riskScore}</div>
        <Link href={`/platform-v7/deals/${topRisk.id}`} style={{ textDecoration: 'none', fontSize: 13, fontWeight: 700, color: '#0A7A5F' }}>Открыть →</Link>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Поиск по ID, культуре, контрагенту..." value={ctSearch} onChange={(e) => setCtSearch(e.target.value)} style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} />
        <select value={ctStatus} onChange={(e) => setCtStatus(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }}><option value="">Все статусы</option><option value="quality_disputed">Споры</option><option value="in_transit">В пути</option><option value="release_requested">Запрос release</option><option value="closed">Закрытые</option></select>
        <select value={ctRisk} onChange={(e) => setCtRisk(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }}><option value="">Все риски</option><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#FAFAFA' }}><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>ID</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Культура</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Стороны</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Статус</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Резерв</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Риск</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>SLA</th></tr></thead>
          <tbody>{controlDeals.map((deal) => <tr key={deal.id} style={{ borderTop: '1px solid #F4F5F7' }}><td style={{ padding: 12, fontFamily: 'monospace', fontWeight: 700 }}><Link href={`/platform-v7/deals/${deal.id}`} style={{ color: '#0A7A5F', textDecoration: 'none' }}>{deal.id}</Link></td><td style={{ padding: 12 }}>{deal.grain}</td><td style={{ padding: 12, fontSize: 13 }}>{deal.seller.name} → {deal.buyer.name}</td><td style={{ padding: 12 }}><Badge tone={deal.status === 'quality_disputed' ? 'danger' : deal.status === 'in_transit' ? 'warning' : 'success'}>{statusLabel(deal.status)}</Badge></td><td style={{ padding: 12, fontWeight: 700 }}>{formatCompactMoney(deal.reservedAmount)}</td><td style={{ padding: 12 }}><Badge tone={riskTone(deal.riskScore)}>{deal.riskScore}</Badge></td><td style={{ padding: 12 }}>{deal.slaDeadline ?? '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </div>;
  }

  function renderDealsList() {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Сделки" sub="Список всех сделок с фильтрами и прямыми переходами в детали." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Поиск по ID, культуре, контрагенту..." value={dealsSearch} onChange={(e) => setDealsSearch(e.target.value)} style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} />
        <select value={dealsStatus} onChange={(e) => setDealsStatus(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }}><option value="">Все статусы</option><option value="quality_disputed">Споры</option><option value="in_transit">В пути</option><option value="release_requested">Запрос release</option><option value="closed">Закрытые</option></select>
        <select value={dealsRisk} onChange={(e) => setDealsRisk(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }}><option value="">Все риски</option><option value="high">Высокий</option><option value="medium">Средний</option><option value="low">Низкий</option></select>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{dealsFiltered.map((deal) => <Link key={deal.id} href={`/platform-v7/deals/${deal.id}`} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1.2fr 1.3fr 1fr auto', gap: 12 }}><div><div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0A7A5F' }}>{deal.id}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{deal.grain} · {deal.quantity} {deal.unit}</div></div><div style={{ fontSize: 13 }}>{deal.seller.name} → {deal.buyer.name}</div><div><Badge tone={deal.status === 'quality_disputed' ? 'danger' : deal.status === 'in_transit' ? 'warning' : 'success'}>{statusLabel(deal.status)}</Badge></div><div style={{ fontWeight: 700 }}>{formatCompactMoney(deal.reservedAmount)}</div></Link>)}</div>
    </div>;
  }

  function renderDealDetail(id: string) {
    const deal = getDealById(id);
    if (!deal) return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 24 }}><div style={{ fontSize: 18, fontWeight: 800 }}>Сделка не найдена</div><div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>Сделка {id} не существует или у тебя нет доступа.</div><Link href="/platform-v7/deals" style={{ display: 'inline-block', marginTop: 16, textDecoration: 'none', color: '#0A7A5F', fontWeight: 700 }}>← Все сделки</Link></div>;
    const actions: Record<string, Array<{ label: string; href?: string }>> = {
      payment_reserved: [{ label: 'Запланировать погрузку' }],
      in_transit: [{ label: 'Отследить рейс' }],
      quality_disputed: [{ label: 'Открыть war-room', href: `/platform-v7/disputes/${deal.dispute?.id ?? ''}` }, { label: 'Предложить partial release 70%' }],
      docs_complete: [{ label: 'Запросить release' }],
      release_requested: [{ label: 'Одобрить release' }],
    };
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div><Link href="/platform-v7/deals" style={{ textDecoration: 'none', color: '#6B778C', fontSize: 13 }}>← Все сделки</Link><SectionTitle title={deal.id} sub={`${deal.grain} · ${deal.quantity} ${deal.unit} · ${deal.seller.name} → ${deal.buyer.name}`} /></div>
      <Stepper status={deal.status} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard title="Резерв" value={formatCompactMoney(deal.reservedAmount)} sub="Под контролем банка" />
        <KpiCard title="Удержание" value={formatCompactMoney(deal.holdAmount)} sub={deal.holdAmount > 0 ? 'Деньги заморожены до решения спора' : 'Удержаний нет'} />
        <KpiCard title="К выпуску" value={formatCompactMoney(deal.releaseAmount ?? Math.round(deal.reservedAmount * 0.7))} sub="70% от резерва" />
        <KpiCard title="Риск" value={String(deal.riskScore)} sub={statusLabel(deal.status)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}>
          <SectionTitle title="Расчёт" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr><td style={{ padding: '8px 0', borderBottom: '1px solid #F4F5F7' }}>Стоимость партии</td><td style={{ padding: '8px 0', borderBottom: '1px solid #F4F5F7', textAlign: 'right', fontWeight: 700 }}>{formatMoney(deal.totalAmount ?? Math.round(deal.quantity * (deal.pricePerTon ?? 14800)))}</td></tr>
            <tr><td style={{ padding: '8px 0', borderBottom: '1px solid #F4F5F7' }}>Зарезервировано банком</td><td style={{ padding: '8px 0', borderBottom: '1px solid #F4F5F7', textAlign: 'right', color: '#0A7A5F', fontWeight: 700 }}>{formatMoney(deal.reservedAmount)}</td></tr>
            <tr><td style={{ padding: '8px 0', borderBottom: '1px solid #F4F5F7' }}>Под hold</td><td style={{ padding: '8px 0', borderBottom: '1px solid #F4F5F7', textAlign: 'right', color: '#DC2626', fontWeight: 700 }}>− {formatMoney(deal.holdAmount)}</td></tr>
            <tr><td style={{ padding: '8px 0', fontWeight: 700 }}>К выпуску</td><td style={{ padding: '8px 0', textAlign: 'right', color: '#16A34A', fontWeight: 800 }}>{formatMoney(deal.releaseAmount ?? Math.round(deal.reservedAmount * 0.7))}</td></tr>
          </tbody></table>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}>
          <SectionTitle title="Доступные действия" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{(actions[deal.status] ?? [{ label: 'Открыть сделку в операционном контуре' }]).map((action) => action.href ? <Link key={action.label} href={action.href} style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontWeight: 700 }}>{action.label}</Link> : <button key={action.label} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E6EA', background: '#FAFAFA', textAlign: 'left', cursor: 'pointer', fontWeight: 700 }}>{action.label}</button>)}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}><SectionTitle title="Маршрут" />{deal.route?.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{deal.route.map((item, idx) => <div key={idx} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10, paddingBottom: 8, borderBottom: idx < deal.route!.length - 1 ? '1px solid #F4F5F7' : 'none' }}><div style={{ color: '#6B778C', fontSize: 12 }}>{item.time}</div><div><div style={{ fontWeight: 600, fontSize: 13 }}>{item.event}</div><div style={{ fontSize: 11, color: '#6B778C' }}>{item.gps ?? ''} {item.driver ?? ''}</div></div></div>)}</div> : <div style={{ color: '#6B778C', fontSize: 13 }}>Маршрут не зафиксирован</div>}</div>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}><SectionTitle title="История" />{deal.events?.length ? <EventTimeline events={deal.events} /> : <div style={{ color: '#6B778C', fontSize: 13 }}>Нет событий</div>}</div>
      </div>
    </div>;
  }

  function renderSeller() {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Воркспейс продавца" sub="Где мои деньги, что мешает выплате и какие документы нужны." />
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, color: '#6B778C' }}>Ближайшая выплата</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#0F1419', marginTop: 4 }}>4 368 000 ₽</div>
        <div style={{ fontSize: 13, color: '#16A34A', marginTop: 4 }}>Готова к выпуску — ожидаем одобрения банка</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <div>✓ Контракт подписан</div>
          <div>✓ Резерв подтверждён банком</div>
          <div>✓ Груз принят на элеваторе</div>
          <div>• Загрузить акт приёмки (форма А)</div>
          <div>• Закрыть спор по качеству (DK-2024-89)</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard title="Получите на счёт" value="6.2 млн ₽" sub="Все ожидаемые выплаты" />
        <KpiCard title="Задержано (спор)" value="624 тыс. ₽" sub="DL-9102 под hold" />
        <KpiCard title="Что мешает выплате" value="2" sub="Спор и акт приёмки" />
        <KpiCard title="Активных сделок" value="6" sub="Текущий портфель" />
      </div>
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}>
        <SectionTitle title="Нужны документы" />
        {sellerMessage ? <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.2)', fontSize: 13 }}>{sellerMessage}</div> : null}
        {['Акт приёмки (форма А)', 'Форма ЗТТ', 'Сертификат качества'].map((label) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #F4F5F7' }}><div><div style={{ fontWeight: 600 }}>{label}</div><div style={{ fontSize: 11, color: '#6B778C' }}>{uploadedDocs.includes(label) ? 'Загружен' : 'В реальном режиме здесь — upload в защищённое хранилище'}</div></div><button onClick={() => simulateUpload(label)} style={{ border: '1px solid #E4E6EA', borderRadius: 8, padding: '8px 12px', background: '#FAFAFA', cursor: 'pointer', fontWeight: 700 }}>{uploadedDocs.includes(label) ? 'Загружен' : 'Загрузить'}</button></div>)}
      </div>
    </div>;
  }

  function renderBuyer() {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Воркспейс покупателя" sub="Shortlist, ценовая аналитика и контроль качества сделки." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard title="Бюджет зарезервирован" value="6.2 млн ₽" sub="Резерв по активным закупкам" />
        <KpiCard title="Под hold" value="624 тыс. ₽" sub="DL-9102 — спор по качеству" />
        <KpiCard title="Споры" value="2" sub="Открытые dispute cases" />
        <KpiCard title="Активных сделок" value="6" sub="Портфель покупателя" />
      </div>
      <div style={{ padding: '14px 16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><div><div style={{ fontWeight: 800, color: '#DC2626' }}>Лаб-результат получен · Спор DK-2024-89</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Нужно открыть сделку и принять решение по partial release.</div></div><Link href="/platform-v7/deals/DL-9102" style={{ textDecoration: 'none', color: '#0A7A5F', fontWeight: 700 }}>Перейти →</Link></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }}><option value="price_asc">Цена: от низкой</option><option value="price_desc">Цена: от высокой</option><option value="quality">По качеству</option><option value="region">По региону</option></select><select value={grainFilter} onChange={(e) => setGrainFilter(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }}><option value="">Все культуры</option><option value="Пшеница 3">Пшеница 3 кл.</option><option value="Пшеница 4">Пшеница 4 кл.</option><option value="Кукуруза">Кукуруза</option><option value="Ячмень">Ячмень</option></select></div>
      <div style={{ display: 'grid', gap: 10 }}>{procurementList.map((item) => { const inShort = shortlist.includes(item.id.replace('RFQ', 'DL')); return <div key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12 }}><div><div style={{ fontWeight: 800 }}>{item.grain}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{item.volume} т · {item.region} · {item.quality}</div></div><div style={{ fontWeight: 700 }}>{formatMoney(item.price)} / т</div><button onClick={() => setShortlist((prev) => inShort ? prev.filter((x) => x !== item.id.replace('RFQ', 'DL')) : [...prev, item.id.replace('RFQ', 'DL')])} style={{ border: '1px solid #E4E6EA', borderRadius: 8, padding: '8px 12px', background: inShort ? 'rgba(10,122,95,0.08)' : '#FAFAFA', cursor: 'pointer', fontWeight: 700 }}>{inShort ? 'В шортлисте' : 'Добавить'}</button></div>; })}</div>
    </div>;
  }

  function renderField() {
    const labels: Record<string, string> = { driver: 'Водитель', surveyor: 'Сюрвейер', elevator: 'Элеватор', lab: 'Лаборант' };
    const actionLabel = fieldPreviewRole === 'driver' ? 'Следующий шаг → подтвердить прибытие' : fieldPreviewRole === 'surveyor' ? 'Следующий шаг → подтвердить взвешивание' : fieldPreviewRole === 'elevator' ? 'Следующий шаг → подтвердить разгрузку' : 'Следующий шаг → опубликовать протокол';
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Полевой экран" sub="Офлайн-очередь, GPS и короткий путь для полевых ролей." />
      {(role === 'operator' || role === 'driver') && <div style={{ display: 'flex', gap: 4, padding: 4, background: '#F4F5F7', borderRadius: 10 }}>{['driver', 'surveyor', 'elevator', 'lab'].map((item) => <button key={item} onClick={() => setFieldPreviewRole(item as any)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: fieldPreviewRole === item ? '#fff' : 'transparent', fontWeight: fieldPreviewRole === item ? 700 : 500 }}>{labels[item]}</button>)}</div>}
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C', fontWeight: 700 }}>Маршрут</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} /><span style={{ fontSize: 13 }}>Тамбов · Хозяйство Ковалёв</span></div>
          <div style={{ width: 2, height: 24, background: '#E4E6EA', marginLeft: 3 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0A7A5F' }} /><span style={{ fontSize: 13, color: '#0A7A5F', fontWeight: 600 }}>Текущее положение · 51.29°N, 37.22°E</span></div>
          <div style={{ width: 2, height: 24, background: '#E4E6EA', marginLeft: 3 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E4E6EA' }} /><span style={{ fontSize: 13, color: '#6B778C' }}>Элеватор Черноземный · ETA 14:30</span></div>
        </div>
      </div>
      <div style={{ background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.2)', borderRadius: 12, padding: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{actionLabel}</div>
        <div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>Роль: {labels[fieldPreviewRole]}</div>
        <button onClick={() => pushFieldEvent(actionLabel)} style={{ marginTop: 14, minHeight: 48, minWidth: 48, padding: '12px 20px', fontSize: 16, fontWeight: 700, border: 'none', background: '#0A7A5F', color: '#fff', borderRadius: 10, cursor: 'pointer' }}>Выполнить шаг</button>
        <button onClick={() => setIsOnline((prev) => !prev)} style={{ marginLeft: 10, minHeight: 48, padding: '12px 20px', fontSize: 14, fontWeight: 700, border: '1px solid #E4E6EA', background: '#fff', borderRadius: 10, cursor: 'pointer' }}>{isOnline ? 'Перейти offline' : 'Вернуться online'}</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><div style={{ fontSize: 12, fontWeight: 700, color: '#6B778C' }}>ОФЛАЙН-ОЧЕРЕДЬ</div><div style={{ fontSize: 11, color: isOnline ? '#16A34A' : '#DC2626' }}>{isOnline ? 'Онлайн' : 'Нет сети'}</div></div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>{fieldQueue.length === 0 ? <div style={{ fontSize: 12, color: '#6B778C' }}>Очередь пуста</div> : fieldQueue.map((item) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #F4F5F7' }}><span style={{ color: item.status === 'sent' ? '#16A34A' : '#D97706', fontWeight: 700 }}>{item.status === 'sent' ? '✓' : '⏳'}</span><span style={{ flex: 1, fontSize: 12 }}>{item.label}</span><span style={{ fontSize: 10, color: '#6B778C' }}>{item.time}</span></div>)}</div>
      </div>
    </div>;
  }

  function renderBank() {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Банк" sub="Резерв, удержание, callbacks и ручной разбор mismatches." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KpiCard title="Резерв" value="6.24 млн ₽" sub="Под контролем банка" />
        <KpiCard title="Удержание · DL-9102" value="624 тыс. ₽" sub="Спор DK-2024-89" />
        <KpiCard title="К выпуску" value="5.76 млн ₽" sub="После закрытия документов" />
        <KpiCard title="Расхождений" value="1" sub="CB-442 требует ручной проверки" />
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{CALLBACKS.map((cb) => <div key={cb.id} style={{ background: cb.status === 'mismatch' ? 'rgba(220,38,38,0.04)' : '#fff', border: `1px solid ${cb.status === 'mismatch' ? 'rgba(220,38,38,0.2)' : '#E4E6EA'}`, borderRadius: 12, padding: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div><div style={{ fontFamily: 'monospace', fontWeight: 800 }}>{cb.id} · {cb.type} · {cb.dealId}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{cb.note}</div></div><div style={{ display: 'flex', gap: 8 }}>{cb.status === 'mismatch' ? <button onClick={() => setExpandedCallback(expandedCallback === cb.id ? '' : cb.id)} style={{ border: '1px solid #E4E6EA', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>Открыть</button> : null}<Link href={cb.status === 'mismatch' ? '/platform-v7/disputes/DK-2024-89' : `/platform-v7/deals/${cb.dealId}`} style={{ textDecoration: 'none', border: '1px solid #E4E6EA', background: '#FAFAFA', borderRadius: 8, padding: '8px 12px', color: '#0F1419', fontWeight: 700 }}>→</Link></div></div>{cb.id === 'CB-442' && expandedCallback === 'CB-442' ? <div style={{ marginTop: 14, padding: 16, borderRadius: 10, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.2)' }}><div style={{ fontWeight: 800, color: '#DC2626' }}>CB-442 · Расхождение качества · 4 дня без ответа</div><div style={{ fontSize: 13, color: '#495057', lineHeight: 1.6, marginTop: 8 }}>Расхождение протеина 0.8% между паспортом ФГИС Зерно (12.4%) и протоколом ЛАБ-2847 (11.6%). Банк Сбер: статус pending manual review. Среднее время обработки: 1.2 дня. Текущий: 4 дня.</div><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button style={{ border: 'none', background: '#DC2626', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}>Эскалировать в Сбер</button><Link href="/platform-v7/disputes/DK-2024-89" style={{ textDecoration: 'none', border: '1px solid #E4E6EA', background: '#fff', borderRadius: 8, padding: '10px 12px', color: '#0F1419', fontWeight: 700 }}>Открыть спор →</Link></div><div style={{ marginTop: 8, fontSize: 11, color: '#6B778C' }}>Затронуто: DL-9102 · Hold 624 000 ₽</div></div> : null}</div>)}</div>
    </div>;
  }

  function renderDisputes() {
    const totalHold = DISPUTES.reduce((sum, item) => sum + item.holdAmount, 0);
    const urgent = DISPUTES.filter((item) => item.slaDaysLeft <= 1).length;
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Споры" sub="War-room, SLA, amount at risk и у кого мяч." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <KpiCard title="Активных споров" value={String(DISPUTES.length)} sub="Открытые war-room cases" />
        <KpiCard title="Под hold (общий)" value={formatCompactMoney(totalHold)} sub="Сумма под удержанием" />
        <KpiCard title="SLA истекает сегодня" value={String(urgent)} sub="Требует немедленной реакции" />
      </div>
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#FAFAFA' }}><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>ID</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Сделка</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Reason</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Hold</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>SLA</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Мяч у</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Evidence</th></tr></thead><tbody>{DISPUTES.map((item) => <tr key={item.id} style={{ borderTop: '1px solid #F4F5F7' }}><td style={{ padding: 12, fontFamily: 'monospace', fontWeight: 800 }}><Link href={`/platform-v7/disputes/${item.id}`} style={{ color: '#0A7A5F', textDecoration: 'none' }}>{item.id}</Link></td><td style={{ padding: 12 }}>{item.dealId}</td><td style={{ padding: 12 }}><Badge tone="warning">{item.reasonCode}</Badge></td><td style={{ padding: 12, fontWeight: 700, color: '#DC2626' }}>{formatCompactMoney(item.holdAmount)}</td><td style={{ padding: 12 }}>{item.slaDaysLeft} дн.</td><td style={{ padding: 12 }}>{item.ballAt}</td><td style={{ padding: 12 }}>{item.evidence.uploaded}/{item.evidence.total}</td></tr>)}</tbody></table></div>
    </div>;
  }

  function renderDisputeDetail(id: string) {
    const dispute = getDisputeById(id);
    if (!dispute) return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 24 }}><div style={{ fontSize: 18, fontWeight: 800 }}>Спор не найден</div><Link href="/platform-v7/disputes" style={{ display: 'inline-block', marginTop: 12, color: '#0A7A5F', fontWeight: 700, textDecoration: 'none' }}>← Все споры</Link></div>;
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div><Link href="/platform-v7/disputes" style={{ textDecoration: 'none', color: '#6B778C', fontSize: 13 }}>← Все споры</Link><SectionTitle title={`${dispute.id} · ${dispute.title}`} sub={dispute.description} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10 }}><span style={{ fontWeight: 800, color: '#D97706' }}>⚽ Мяч у:</span><span style={{ fontWeight: 800 }}>{dispute.ballAt}</span><span style={{ fontSize: 12, color: '#6B778C' }}>— нужно загрузить заключение эксперта</span><button style={{ marginLeft: 'auto', border: 'none', background: '#0A7A5F', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}>Отправить уведомление</button></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}><KpiCard title="Сделка" value={dispute.dealId} sub="Затронутая сделка" /><KpiCard title="Hold" value={formatCompactMoney(dispute.holdAmount)} sub="Под удержанием" /><KpiCard title="SLA" value={`${dispute.slaDaysLeft} дн.`} sub="До дедлайна решения" /><KpiCard title="Evidence" value={`${dispute.evidence.uploaded}/${dispute.evidence.total}`} sub="Загружено доказательств" /></div>
      <div style={{ display: 'flex', gap: 10 }}><button onClick={() => downloadFile(`evidence-pack-${dispute.id}.txt`, `Evidence Pack\n${dispute.id}\nDeal: ${dispute.dealId}\nReason: ${dispute.reasonCode}\nHold: ${dispute.holdAmount}`)} style={{ border: '1px solid #E4E6EA', background: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}>Сформировать Evidence Pack</button><Link href={`/platform-v7/deals/${dispute.dealId}`} style={{ textDecoration: 'none', border: '1px solid #E4E6EA', background: '#FAFAFA', borderRadius: 8, padding: '10px 12px', color: '#0F1419', fontWeight: 700 }}>Открыть сделку →</Link></div>
    </div>;
  }

  function renderCompliance() {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Комплаенс" sub="Аудит-лог, экспорт CSV и фильтры по актору и дате." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input placeholder="Поиск..." value={complianceSearch} onChange={(e) => setComplianceSearch(e.target.value)} style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /><select value={complianceActor} onChange={(e) => setComplianceActor(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }}><option value="">Все акторы</option>{Array.from(new Set(AUDIT_LOG.map((item) => item.actor))).map((actor) => <option key={actor} value={actor}>{actor}</option>)}</select><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /><button onClick={() => downloadFile(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, ['Время,Актор,Действие,Тип,Объект', ...filteredAudit.map((e) => `${e.ts},${e.actor},${e.action},${e.type},${e.object ?? ''}`)].join('\n'), 'text/csv;charset=utf-8')} style={{ border: '1px solid #E4E6EA', background: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}>Экспорт CSV</button></div>
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#FAFAFA' }}><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Время</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Актор</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Действие</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Тип</th><th style={{ textAlign: 'left', padding: 12, fontSize: 12 }}>Объект</th></tr></thead><tbody>{filteredAudit.map((entry, idx) => <tr key={idx} style={{ borderTop: '1px solid #F4F5F7' }}><td style={{ padding: 12, fontSize: 12 }}>{new Date(entry.ts).toLocaleString('ru-RU')}</td><td style={{ padding: 12 }}>{entry.actor}</td><td style={{ padding: 12 }}>{entry.action}</td><td style={{ padding: 12 }}><Badge tone={entry.type === 'danger' ? 'danger' : entry.type === 'warning' ? 'warning' : 'success'}>{entry.type}</Badge></td><td style={{ padding: 12 }}>{entry.object ?? '—'}</td></tr>)}</tbody></table></div>
    </div>;
  }

  function renderProcurement() {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Закупки (RFQ)" sub="Покупательский модуль закупки с формой и списком запросов." />
      <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C', fontWeight: 700 }}>Создание RFQ · шаг {rfqStep}/4</div>
        {rfqStep === 1 && <div style={{ display: 'grid', gap: 10, marginTop: 14 }}><input value={rfqForm.grain} onChange={(e) => setRfqForm({ ...rfqForm, grain: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /><input value={rfqForm.volume} onChange={(e) => setRfqForm({ ...rfqForm, volume: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /></div>}
        {rfqStep === 2 && <div style={{ display: 'grid', gap: 10, marginTop: 14 }}><input value={rfqForm.region} onChange={(e) => setRfqForm({ ...rfqForm, region: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /><input value={rfqForm.payment} onChange={(e) => setRfqForm({ ...rfqForm, payment: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /></div>}
        {rfqStep === 3 && <div style={{ display: 'grid', gap: 10, marginTop: 14 }}><input value={rfqForm.quality} onChange={(e) => setRfqForm({ ...rfqForm, quality: e.target.value })} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4E6EA' }} /></div>}
        {rfqStep === 4 && <div style={{ marginTop: 14, fontSize: 13, color: '#495057' }}>{rfqForm.grain} · {rfqForm.volume} т · {rfqForm.region} · {rfqForm.payment} · {rfqForm.quality}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button onClick={() => setRfqStep((prev) => Math.max(1, prev - 1))} style={{ border: '1px solid #E4E6EA', background: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}>Назад</button><button onClick={() => setRfqStep((prev) => prev < 4 ? prev + 1 : 4)} style={{ border: 'none', background: '#0A7A5F', color: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontWeight: 700 }}>{rfqStep < 4 ? 'Далее' : 'Готово'}</button></div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{RFQ_LIST.map((rfq) => <div key={rfq.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12 }}><div><div style={{ fontWeight: 800 }}>{rfq.id} · {rfq.grain}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{rfq.volume} т · {rfq.region} · {rfq.quality}</div></div><div style={{ fontWeight: 700 }}>{formatMoney(rfq.price)} / т</div><button style={{ border: '1px solid #E4E6EA', background: '#FAFAFA', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>Подать offer</button></div>)}</div>
    </div>;
  }

  function renderAnalytics() {
    const months = [{ month: 'Янв', count: 12, volume: 45000000 }, { month: 'Фев', count: 18, volume: 67000000 }, { month: 'Мар', count: 24, volume: 91000000 }, { month: 'Апр', count: 31, volume: 118000000 }];
    const maxCount = Math.max(...months.map((item) => item.count));
    const maxVolume = Math.max(...months.map((item) => item.volume));
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle title="Аналитика" sub="Executive view по сделкам, обороту и спорности." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}><KpiCard title="Спорность" value="8%" sub="Доля спорных сделок" /><KpiCard title="Средний чек" value="4.2 млн ₽" sub="Средний размер сделки" /><KpiCard title="Time to close" value="8.3 дня" sub="Среднее время закрытия" /><KpiCard title="Сделок в апреле" value="31" sub="Максимум в текущем ряду" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}><SectionTitle title="Сделки по месяцам" /> <div style={{ display: 'flex', alignItems: 'end', gap: 12, height: 220 }}>{months.map((item) => <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><div style={{ fontSize: 11, color: '#6B778C' }}>{item.count}</div><div style={{ width: 42, height: `${Math.max(20, (item.count / maxCount) * 150)}px`, borderRadius: 8, background: '#0A7A5F' }} /><div style={{ fontSize: 11, color: '#6B778C' }}>{item.month}</div></div>)}</div></div>
        <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 18 }}><SectionTitle title="Оборот по месяцам" /> <div style={{ display: 'flex', alignItems: 'end', gap: 12, height: 220 }}>{months.map((item) => <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><div style={{ fontSize: 11, color: '#6B778C' }}>{Math.round(item.volume / 1000000)} млн</div><div style={{ width: 42, height: `${Math.max(20, (item.volume / maxVolume) * 150)}px`, borderRadius: 8, background: '#6B778C' }} /><div style={{ fontSize: 11, color: '#6B778C' }}>{item.month}</div></div>)}</div></div>
      </div>
    </div>;
  }

  const first = slug[0];
  if (!first) return null;
  if (first === 'control-tower') return renderControlTower();
  if (first === 'deals' && slug.length === 1) return renderDealsList();
  if (first === 'deals' && slug[1]) return renderDealDetail(slug[1]);
  if (first === 'seller') return renderSeller();
  if (first === 'buyer') return renderBuyer();
  if (first === 'field') return renderField();
  if (first === 'bank') return renderBank();
  if (first === 'disputes' && slug.length === 1) return renderDisputes();
  if (first === 'disputes' && slug[1]) return renderDisputeDetail(slug[1]);
  if (first === 'compliance') return renderCompliance();
  if (first === 'procurement') return renderProcurement();
  if (first === 'analytics') return renderAnalytics();

  return <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 24 }}><div style={{ fontSize: 18, fontWeight: 800 }}>Страница не найдена</div><div style={{ fontSize: 13, color: '#6B778C', marginTop: 6 }}>Запрошенный экран отсутствует.</div><Link href="/platform-v7/control-tower" style={{ display: 'inline-block', marginTop: 16, color: '#0A7A5F', fontWeight: 700, textDecoration: 'none' }}>← На главную платформы</Link></div>;
}
