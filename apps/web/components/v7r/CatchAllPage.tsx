'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AUDIT_LOG, CALLBACKS, DEALS, DISPUTES, RFQ_LIST, getDealById, getDisputeById } from '@/lib/v7r/data';
import { classForTone, formatCompactMoney, formatMoney, statusLabel } from '@/lib/v7r/helpers';
import { usePlatformV7RStore } from '@/stores/usePlatformV7RStore';
import { RiskBadge } from '@/components/v7r/RiskBadge';
import { useToast } from '@/components/v7r/Toast';

const BALL_AT_LABELS: Record<string, string> = {
  seller: 'Продавец',
  buyer: 'Покупатель',
  lab: 'Лаборатория',
  arbitrator: 'Арбитр',
  bank: 'Банк',
  operator: 'Оператор',
};

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

function toneByRisk(score: number): Tone {
  if (score >= 70) return 'danger';
  if (score >= 30) return 'warning';
  return 'success';
}

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

function Notice({ tone, text }: { tone: Tone; text: string }) {
  const palette = classForTone(tone);
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, fontSize: 13, fontWeight: 700 }}>
      {text}
    </div>
  );
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const palette = classForTone(tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color, fontSize: 11, fontWeight: 800 }}>
      {children}
    </span>
  );
}

function Card({ title, value, subtitle, href }: { title: string; value: string; subtitle: string; href?: string }) {
  const body = (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, minHeight: 116 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: '#0F1419', marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', marginTop: 8, lineHeight: 1.5 }}>{subtitle}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{body}</Link> : body;
}

function Panel({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
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

function Btn({ label, href, onClick, tone = 'neutral' }: { label: string; href?: string; onClick?: () => void; tone?: Tone }) {
  const styles = {
    neutral: { background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419' },
    success: { background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff' },
    warning: { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)', color: '#B45309' },
    danger: { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#B91C1C' },
  }[tone];
  const style: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...styles };
  return href ? <Link href={href} style={style}>{label}</Link> : <button onClick={onClick} style={style}>{label}</button>;
}

function Stepper({ status }: { status: string }) {
  const phases = [
    { id: 'contract', label: 'Контракт', statuses: ['draft', 'contract_signed', 'payment_reserved'] },
    { id: 'logistics', label: 'Логистика', statuses: ['loading_scheduled', 'loading_started', 'loading_done', 'in_transit', 'arrived'] },
    { id: 'acceptance', label: 'Приёмка', statuses: ['unloading_started', 'unloading_done', 'quality_check', 'quality_approved', 'quality_disputed'] },
    { id: 'documents', label: 'Документы', statuses: ['docs_complete'] },
    { id: 'settlement', label: 'Расчёт', statuses: ['release_requested', 'release_approved', 'closed'] },
  ];
  const current = phases.findIndex((phase) => phase.statuses.includes(status));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      {phases.map((phase, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div key={phase.id} style={{ padding: '12px 12px', borderRadius: 14, background: active ? 'rgba(10,122,95,0.08)' : done ? 'rgba(22,163,74,0.08)' : '#F8FAFB', border: `1px solid ${active ? 'rgba(10,122,95,0.18)' : done ? 'rgba(22,163,74,0.18)' : '#E4E6EA'}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#0A7A5F' : done ? '#15803D' : '#64748B' }}>{phase.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CatchAllPage() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[1] ?? '';
  const second = segments[2];
  const { role, fieldPreviewRole, setFieldPreviewRole } = usePlatformV7RStore();
  const toast = useToast();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [risk, setRisk] = React.useState('');
  const [sortBy, setSortBy] = React.useState('price_asc');
  const [grainFilter, setGrainFilter] = React.useState('');
  const [fieldQueue, setFieldQueue] = React.useState<Array<{ id: string; label: string; status: 'queued' | 'sent'; time: string }>>([]);
  const [isOnline, setIsOnline] = React.useState(true);
  const [complianceSearch, setComplianceSearch] = React.useState('');
  const [complianceActor, setComplianceActor] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [rfqStep, setRfqStep] = React.useState(1);
  const [rfqForm, setRfqForm] = React.useState({ grain: 'Пшеница 4 кл.', volume: '300', region: 'Тамбовская обл.', payment: 'Банк / резерв', quality: 'ГОСТ / влажность ≤14%' });
  const [hoveredRow, setHoveredRow] = React.useState<string | null>(null);
  const [expandedCallback, setExpandedCallback] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const filteredDeals = DEALS.filter((deal) => {
    const q = `${deal.id} ${deal.grain} ${deal.seller.name} ${deal.buyer.name}`.toLowerCase();
    const searchOk = !search || q.includes(search.toLowerCase());
    const statusOk = !status || deal.status === status;
    const riskOk = !risk || (risk === 'high' ? deal.riskScore >= 70 : risk === 'medium' ? deal.riskScore >= 30 && deal.riskScore < 70 : deal.riskScore < 30);
    return searchOk && statusOk && riskOk;
  });

  const filteredRfq = [...RFQ_LIST]
    .filter((item) => !grainFilter || item.grain.toLowerCase().includes(grainFilter.toLowerCase()))
    .sort((a, b) => sortBy === 'price_desc' ? b.price - a.price : sortBy === 'quality' ? a.quality.localeCompare(b.quality) : sortBy === 'region' ? a.region.localeCompare(b.region) : a.price - b.price);

  const filteredAudit = AUDIT_LOG.filter((entry) => {
    const q = `${entry.actor} ${entry.action} ${entry.object ?? ''}`.toLowerCase();
    const searchOk = !complianceSearch || q.includes(complianceSearch.toLowerCase());
    const actorOk = !complianceActor || entry.actor === complianceActor;
    const fromOk = !dateFrom || entry.ts >= `${dateFrom}T00:00:00Z`;
    const toOk = !dateTo || entry.ts <= `${dateTo}T23:59:59Z`;
    return searchOk && actorOk && fromOk && toOk;
  });

  function notify(text: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') {
    toast(text, type);
  }

  function pushField(label: string) {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setFieldQueue((prev) => [{ id: String(Date.now()), label, status: isOnline ? 'sent' : 'queued', time }, ...prev]);
    notify(isOnline ? 'Событие отправлено в контур.' : 'Событие осталось в офлайн-очереди.', isOnline ? 'success' : 'warning');
  }

  function handleRefresh() {
    setLoading(true);
    setTimeout(() => { setLoading(false); toast('Данные обновлены', 'success'); }, 800);
  }

  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const activeDeals = DEALS.filter((item) => item.status !== 'closed').length;
  const topRisk = [...DEALS].sort((a, b) => b.riskScore - a.riskScore)[0];

  const fieldRole = role === 'driver' || role === 'surveyor' || role === 'elevator' || role === 'lab' ? role : fieldPreviewRole;
  const fieldAction = fieldRole === 'driver' ? 'Подтвердить прибытие машины' : fieldRole === 'surveyor' ? 'Подтвердить взвешивание и фотофиксацию' : fieldRole === 'elevator' ? 'Подтвердить разгрузку' : 'Опубликовать протокол качества';

  const deal = first === 'deals' && second ? getDealById(second) : null;
  const dispute = first === 'disputes' && second ? getDisputeById(second) : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {first === 'control-tower' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card title="Деньги в контуре" value={formatCompactMoney(totalReserved)} subtitle="Резерв по активным сделкам" href="/platform-v7/deals" />
            <Card title="Под удержанием" value={formatCompactMoney(totalHold)} subtitle="Деньги заморожены до разбора" href="/platform-v7/disputes" />
            <Card title="Документы готовы" value={`${DEALS.length - DEALS.filter((d) => d.blockers.includes('docs')).length}/${DEALS.length}`} subtitle="Сделки без документного стоп-фактора" href="/platform-v7/deals" />
            <Card title="Активные сделки" value={String(activeDeals)} subtitle="Все открытые сделки" href="/platform-v7/deals" />
          </div>
          <Panel title="Центр управления" subtitle="Единый обзор сделок, денег, блокировок и спорности." actions={<Btn label={loading ? 'Обновляем…' : 'Обновить данные'} onClick={handleRefresh} />}>
            <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>Самая рискованная сделка</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#6B778C' }}>{topRisk.id} · {topRisk.grain}</span>
                  <RiskBadge score={topRisk.riskScore} />
                </div>
              </div>
              <Btn label="Открыть сделку" href={`/platform-v7/deals/${topRisk.id}`} tone="danger" />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по номеру сделки, культуре или стороне..." style={{ flex: 1, minWidth: 230, padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}><option value="">Все статусы</option><option value="quality_disputed">Есть спор</option><option value="in_transit">В пути</option><option value="release_requested">Ожидает выпуск</option><option value="closed">Закрыта</option></select>
              <select value={risk} onChange={(e) => setRisk(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}><option value="">Все риски</option><option value="high">Высокий ≥70</option><option value="medium">Средний 30–69</option><option value="low">Низкий &lt;30</option></select>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {filteredDeals.map((d) => (
                <div
                  key={d.id}
                  onClick={() => router.push(`/platform-v7/deals/${d.id}`)}
                  onMouseEnter={() => setHoveredRow(d.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: hoveredRow === d.id ? '#F5F7F8' : '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, cursor: 'pointer', transition: 'background 0.15s' }}>
                  <div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{d.id}</div><div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>{d.grain} · {d.quantity} {d.unit}</div></div>
                  <div style={{ fontSize: 12, color: '#0F1419' }}>{d.seller.name} → {d.buyer.name}</div>
                  <div><Badge tone={d.status === 'quality_disputed' ? 'danger' : d.status === 'in_transit' ? 'warning' : 'success'}>{statusLabel(d.status)}</Badge></div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{formatCompactMoney(d.reservedAmount)}</div>
                  <div><RiskBadge score={d.riskScore} /></div>
                  <div style={{ fontSize: 11, color: '#6B778C' }}>
                    {d.status === 'quality_disputed' ? '⚠️ Закрыть спор' : d.status === 'release_requested' ? '✅ Подтвердить выпуск' : d.status === 'docs_complete' ? '📄 Запросить выпуск' : d.status === 'in_transit' ? '🚛 Ожидание доставки' : '—'}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {first === 'deals' && !second && (
        <Panel title="Сделки" subtitle="Все сделки с быстрым переходом в карточку и денежный контур.">
          <div style={{ display: 'grid', gap: 8 }}>
            {filteredDeals.map((d) => (
              <div
                key={d.id}
                onClick={() => router.push(`/platform-v7/deals/${d.id}`)}
                onMouseEnter={() => setHoveredRow(d.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{ background: hoveredRow === d.id ? '#F5F7F8' : '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, cursor: 'pointer', transition: 'background 0.15s' }}>
                <div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{d.id}</div><div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>{d.grain} · {d.quantity} {d.unit}</div></div>
                <div style={{ fontSize: 12, color: '#0F1419' }}>{d.seller.name} → {d.buyer.name}</div>
                <div><Badge tone={d.status === 'quality_disputed' ? 'danger' : d.status === 'in_transit' ? 'warning' : 'success'}>{statusLabel(d.status)}</Badge></div>
                <div style={{ fontWeight: 700, color: '#0F1419', fontSize: 13 }}>{formatCompactMoney(d.reservedAmount)}</div>
                <div><RiskBadge score={d.riskScore} /></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {first === 'deals' && second && (
        deal ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <Panel title={deal.id} subtitle={`${deal.grain} · ${deal.quantity} ${deal.unit} · ${deal.seller.name} → ${deal.buyer.name}`} actions={<Btn label="Все сделки" href="/platform-v7/deals" />}>
              <Stepper status={deal.status} />
            </Panel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Card title="Резерв" value={formatCompactMoney(deal.reservedAmount)} subtitle="Под контролем банка" />
              <Card title="Удержание" value={formatCompactMoney(deal.holdAmount)} subtitle={deal.holdAmount > 0 ? 'Деньги заморожены до решения' : 'Удержаний нет'} />
              <Card title="К выпуску" value={formatCompactMoney(deal.releaseAmount ?? Math.round(deal.reservedAmount * 0.7))} subtitle="Сумма к перечислению после подтверждений" />
              <Card title="Риск" value={String(deal.riskScore)} subtitle={statusLabel(deal.status)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              <Panel title="Деньги по сделке" subtitle="Разбивка суммы, удержаний и ожидаемого выпуска.">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
                  <tr><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>Стоимость партии</td><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700 }}>{formatMoney(deal.totalAmount ?? Math.round(deal.quantity * (deal.pricePerTon ?? 14800)))}</td></tr>
                  <tr><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>Зарезервировано</td><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700, color: '#0A7A5F' }}>{formatMoney(deal.reservedAmount)}</td></tr>
                  <tr><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5' }}>Под удержанием</td><td style={{ padding: '10px 0', borderBottom: '1px solid #F1F3F5', textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>− {formatMoney(deal.holdAmount)}</td></tr>
                  <tr><td style={{ padding: '10px 0', fontWeight: 800 }}>К выплате</td><td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, color: '#15803D' }}>{formatMoney(deal.releaseAmount ?? Math.round(deal.reservedAmount * 0.7))}</td></tr>
                </tbody></table>
              </Panel>
              <Panel title="Следующее действие" subtitle="Только то, что помогает двигать сделку дальше.">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {deal.status === 'quality_disputed' ? <><Btn label="Открыть спор" href={`/platform-v7/disputes/${deal.dispute?.id ?? ''}`} tone="danger" /><Btn label="Предложить частичный выпуск" tone="warning" onClick={() => notify(`По ${deal.id} отправлено предложение частичного выпуска.`, 'warning')} /></> : deal.status === 'docs_complete' ? <Btn label="Запросить выпуск денег" tone="success" onClick={() => notify(`По ${deal.id} отправлен запрос на выпуск.`)} /> : deal.status === 'release_requested' ? <Btn label="Подтвердить выпуск" tone="success" onClick={() => notify(`По ${deal.id} выпуск подтверждён.`)} /> : <Btn label="Открыть сделку в операционном контуре" onClick={() => notify(`Карточка сделки ${deal.id} открыта.`)} />}
                </div>
              </Panel>
            </div>
          </div>
        ) : <Panel title="Сделка не найдена" subtitle={`Сделка ${second} не существует или недоступна.`}><Btn label="Вернуться к списку" href="/platform-v7/deals" /></Panel>
      )}

      {first === 'seller' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <Panel title="Кабинет продавца" subtitle="Где деньги, что мешает выплате и какие документы ещё нужны.">
            <div style={{ padding: 18, borderRadius: 18, background: 'linear-gradient(180deg, rgba(10,122,95,0.08) 0%, rgba(255,255,255,0.9) 100%)', border: '1px solid rgba(10,122,95,0.14)' }}>
              <div style={{ fontSize: 12, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Ближайшая выплата</div>
              <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 800, color: '#0F1419', marginTop: 8 }}>4 368 000 ₽</div>
              <div style={{ fontSize: 13, color: '#15803D', marginTop: 8 }}>После закрытия спора и проверки акта сумма будет выпущена.</div>
            </div>
          </Panel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card title="Получите на счёт" value="6,2 млн ₽" subtitle="Все ожидаемые выплаты" />
            <Card title="Задержано из-за спора" value="624 тыс. ₽" subtitle="Сделка DL-9102 под удержанием" />
            <Card title="Что мешает выплате" value="2" subtitle="Открытый спор и незагруженный акт" />
            <Card title="Активные сделки" value="6" subtitle="Текущий портфель продавца" />
          </div>
          <Panel title="Нужны документы" subtitle="В демо-контуре загрузка имитируется, в живом — ведёт в защищённое хранилище.">
            <div style={{ display: 'grid', gap: 10 }}>
              {['Акт приёмки', 'Форма ЗТТ', 'Сертификат качества', 'Протокол разгрузки'].map((label) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid #F1F3F5' }}>
                  <div><div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>После загрузки документ станет доступен банку и оператору.</div></div>
                  <Btn label="Загрузить" onClick={() => notify(`${label} добавлен в демо-контуре.`)} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {first === 'buyer' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card title="Бюджет в резерве" value="6,2 млн ₽" subtitle="Деньги уже заведены в контур" />
            <Card title="Под удержанием" value="624 тыс. ₽" subtitle="Открытый спор по качеству" />
            <Card title="Спорные сделки" value="2" subtitle="Нужно решение по качеству и весу" />
            <Card title="Активные закупки" value="6" subtitle="Текущий портфель покупателя" />
          </div>
          <Panel title="Кабинет покупателя" subtitle="Отбор предложений, контроль качества и решение по выпуску денег." actions={<Btn label="Открыть проблемную сделку" href="/platform-v7/deals/DL-9102" tone="danger" />}>
            <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.14)', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C' }}>Есть лабораторное расхождение по DL-9102</div>
              <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Нужно открыть сделку, сверить качество и решить вопрос с частичным выпуском денег.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}><option value="price_asc">Цена: от низкой</option><option value="price_desc">Цена: от высокой</option><option value="quality">По качеству</option><option value="region">По региону</option></select>
              <select value={grainFilter} onChange={(e) => setGrainFilter(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}><option value="">Все культуры</option><option value="Пшеница 3">Пшеница 3 кл.</option><option value="Пшеница 4">Пшеница 4 кл.</option><option value="Кукуруза">Кукуруза</option><option value="Ячмень">Ячмень</option></select>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredRfq.map((item) => (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
                  <div><div style={{ fontSize: 15, fontWeight: 800 }}>{item.grain}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{item.volume} т · {item.region} · {item.quality}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(item.price)} / т</div>
                  <div style={{ fontSize: 12, color: '#6B778C' }}>{item.payment}</div>
                  <Btn label="Добавить в отбор" onClick={() => notify(`${item.id} добавлен в отбор.`)} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {first === 'logistics' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card title="Машины в рейсе" value="12" subtitle="Активный парк по открытым сделкам" />
            <Card title="Ожидают приёмку" value="3" subtitle="Очередь на элеваторе и разгрузке" />
            <Card title="Отклонения маршрута" value="1" subtitle="Требует внимания диспетчера" />
            <Card title="Средний ETA" value="1 ч 24 мин" subtitle="До ближайшей точки прибытия" />
          </div>
          <Panel title="Логистика" subtitle="Диспетчерская по рейсам, очередям, ETA и проблемным точкам.">
            <div style={{ display: 'grid', gap: 10 }}>
              {[{ route: 'Маршрут ТМБ-14', status: 'В пути', eta: '14:30', note: 'Маршрут без отклонений', href: '/platform-v7/deals/DL-9102' }, { route: 'Маршрут ВРЖ-08', status: 'Ожидание погрузки', eta: '16:10', note: 'Требуется подтверждение склада', href: '/platform-v7/deals/DL-9106' }, { route: 'Маршрут КРС-03', status: 'На приёмке', eta: 'сейчас', note: 'Идёт разгрузка на элеваторе', href: '/platform-v7/deals/DL-9103' }].map((row) => (
                <div key={row.route} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
                  <div><div style={{ fontSize: 15, fontWeight: 800 }}>{row.route}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{row.note}</div></div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{row.status}</div>
                  <div style={{ fontSize: 13, color: '#0F1419' }}>ETA: {row.eta}</div>
                  <Btn label="Открыть связанную сделку" href={row.href} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {first === 'field' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <Panel title="Поле и приёмка" subtitle="Один экран для водителя, сюрвейера, элеватора и лаборатории.">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['driver', 'surveyor', 'elevator', 'lab'] as const).map((entry) => (
                <button key={entry} onClick={() => setFieldPreviewRole(entry)} style={{ border: fieldRole === entry ? '1px solid rgba(10,122,95,0.16)' : '1px solid #E4E6EA', background: fieldRole === entry ? 'rgba(10,122,95,0.08)' : '#fff', color: fieldRole === entry ? '#0A7A5F' : '#0F1419', borderRadius: 999, padding: '10px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{entry === 'driver' ? 'Водитель' : entry === 'surveyor' ? 'Сюрвейер' : entry === 'elevator' ? 'Элеватор' : 'Лаборатория'}</button>
              ))}
            </div>
          </Panel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <Panel title="Маршрут" subtitle="Короткая логика движения, текущая точка и ожидаемое прибытие."><div style={{ display: 'grid', gap: 10 }}><div style={{ fontSize: 13 }}>Хозяйство Ковалёв · старт погрузки</div><div style={{ fontSize: 13, fontWeight: 700, color: '#0A7A5F' }}>Текущая точка · 51.2934, 37.2185</div><div style={{ fontSize: 13, color: '#475569' }}>Элеватор Чернозёмный · ETA 14:30</div></div></Panel>
            <Panel title="Следующее действие" subtitle="Система показывает один ожидаемый шаг."><div style={{ padding: 16, borderRadius: 16, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.14)' }}><div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>{fieldAction}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 8 }}>Подтверждение уходит в контур сделки и становится основанием для следующего этапа.</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}><Btn label="Выполнить шаг" onClick={() => pushField(fieldAction)} tone="success" /><Btn label={isOnline ? 'Перейти офлайн' : 'Вернуться онлайн'} onClick={() => setIsOnline((p) => !p)} /></div></div></Panel>
          </div>
          <Panel title="Офлайн-очередь" subtitle="Если сеть пропала, события не теряются и ждут отправки.">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}><Badge tone={isOnline ? 'success' : 'warning'}>{isOnline ? 'Связь есть' : 'Нет связи'}</Badge><div style={{ fontSize: 12, color: '#6B778C' }}>Накоплено событий: {fieldQueue.length}</div></div>
            <div style={{ display: 'grid', gap: 8 }}>{fieldQueue.length === 0 ? <div style={{ fontSize: 13, color: '#6B778C' }}>Очередь пока пуста.</div> : fieldQueue.map((item) => <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, padding: '10px 0', borderTop: '1px solid #F1F3F5', alignItems: 'center' }}><span style={{ fontSize: 16 }}>{item.status === 'sent' ? '✓' : '⏳'}</span><span style={{ fontSize: 13 }}>{item.label}</span><span style={{ fontSize: 11, color: '#6B778C' }}>{item.time}</span></div>)}</div>
          </Panel>
        </div>
      )}

      {first === 'bank' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card title="Резерв" value="6,24 млн ₽" subtitle="Деньги подтверждены и заведены в контур" />
            <Card title="Под удержанием" value="624 тыс. ₽" subtitle="Спор DK-2024-89" />
            <Card title="К выпуску" value="5,76 млн ₽" subtitle="После закрытия блокеров" />
            <Card title="Расхождения" value="1" subtitle="Есть ручная банковая проверка" />
          </div>
          <Panel title="Банковый контур" subtitle="Резерв, удержание, выпуск и ручной разбор расхождений.">
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
              <div><strong>Таймлайн транзакций</strong></div>
              <div>12.04.2026 09:15 — Резерв 6 240 000 ₽ подтверждён по DL-9102 <span style={{ color: '#16A34A' }}>✅</span></div>
              <div>12.04.2026 10:05 — Удержание 624 000 ₽ активировано (спор DK-2024-89) <span style={{ color: '#D97706' }}>⚠️</span></div>
              <div>12.04.2026 14:00 — Ожидание ручной проверки CB-442 (4 дня) <span style={{ color: '#DC2626' }}>❌</span></div>
              <div>12.04.2026 15:30 — Запрос release по DL-9109 поступил на проверку <span style={{ color: '#0B6B9A' }}>ℹ️</span></div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {CALLBACKS.map((callback) => (
                <div key={callback.id} style={{ background: callback.status === 'mismatch' ? 'rgba(220,38,38,0.04)' : '#fff', border: `1px solid ${callback.status === 'mismatch' ? 'rgba(220,38,38,0.16)' : '#E4E6EA'}`, borderRadius: 16, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13 }}>{callback.id} · {callback.type} · {callback.dealId}</div>
                      <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{callback.note}</div>
                      {callback.daysOpen ? <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Открыто {callback.daysOpen} дн.</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge tone={callback.status === 'ok' ? 'success' : callback.status === 'mismatch' ? 'danger' : 'warning'}>
                        {callback.status === 'ok' ? '✅ OK' : callback.status === 'mismatch' ? '❌ Расхождение' : '⏳ Ожидание'}
                      </Badge>
                    </div>
                  </div>
                  {callback.status === 'mismatch' && (
                    <div style={{ marginTop: 12 }}>
                      <button onClick={() => setExpandedCallback(expandedCallback === callback.id ? null : callback.id)} style={{ fontSize: 12, fontWeight: 700, color: '#0B6B9A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8 }}>
                        {expandedCallback === callback.id ? '▲ Скрыть детали' : '▼ Показать детали расхождения'}
                      </button>
                      {expandedCallback === callback.id && (
                        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626', marginBottom: 10 }}>
                          <div><strong>Протеин ФГИС:</strong> 9.2%</div>
                          <div><strong>Протеин ЛАБ-2847:</strong> 10.0%</div>
                          <div><strong>Расхождение:</strong> 0.8% — выше порога в 0.5%</div>
                          <div style={{ marginTop: 6 }}><strong>Требуется:</strong> ручная верификация или повторный анализ</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn label="Выпустить вручную" tone="success" onClick={() => notify('Запрос на ручной выпуск отправлен на авторизацию', 'info')} />
                        <Btn label="Эскалировать арбитру" tone="danger" onClick={() => notify('Кейс эскалирован арбитру', 'warning')} />
                        <Btn label="Открыть спор" href="/platform-v7/disputes/DK-2024-89" />
                      </div>
                    </div>
                  )}
                  {callback.status !== 'mismatch' && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <Btn label="Открыть сделку" href={`/platform-v7/deals/${callback.dealId}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {first === 'disputes' && !second && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card title="Активные споры" value={String(DISPUTES.length)} subtitle="Комнаты разбора по проблемным сделкам" />
            <Card title="Под удержанием" value={formatCompactMoney(DISPUTES.reduce((sum, item) => sum + item.holdAmount, 0))} subtitle="Сумма замороженных денег" />
            <Card title="Дедлайн сегодня" value={String(DISPUTES.filter((item) => item.slaDaysLeft <= 1).length)} subtitle="Требует немедленной реакции" />
          </div>
          <Panel title="Споры" subtitle="Кто владеет следующим шагом и насколько полон пакет доказательств.">
            <div style={{ display: 'grid', gap: 10 }}>
              {DISPUTES.map((item) => {
                const pct = Math.round((item.evidence.uploaded / item.evidence.total) * 100);
                return (
                  <Link key={item.id} href={`/platform-v7/disputes/${item.id}`} style={{ textDecoration: 'none', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 10 }}>
                      <div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0A7A5F', fontSize: 13 }}>{item.id}</div><div style={{ fontSize: 11, color: '#6B778C', marginTop: 3 }}>{item.dealId} · {item.title}</div></div>
                      <div><Badge tone="warning">{item.reasonCode}</Badge></div>
                      <div style={{ fontWeight: 700, color: '#B91C1C', fontSize: 13 }}>{formatCompactMoney(item.holdAmount)}</div>
                      <div style={{ fontSize: 12, color: '#0F1419' }}>Мяч у: <strong>{BALL_AT_LABELS[item.ballAt] ?? item.ballAt}</strong></div>
                      <div style={{ fontSize: 12, color: '#6B778C' }}>SLA: {item.slaDaysLeft} дн.</div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#6B778C' }}>Пакет доказательств</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{item.evidence.uploaded}/{item.evidence.total}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: '#E4E6EA', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#0A7A5F' : '#D97706', borderRadius: 999 }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {first === 'disputes' && second && (
        dispute ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <Panel title={`${dispute.id} · ${dispute.title}`} subtitle={dispute.description} actions={<Btn label="Все споры" href="/platform-v7/disputes" />}>
              <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.16)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div style={{ fontSize: 13, fontWeight: 800, color: '#B45309' }}>У кого следующий шаг: {BALL_AT_LABELS[dispute.ballAt] ?? dispute.ballAt}</div><Btn label="Отправить напоминание" tone="warning" onClick={() => notify('Уведомление отправлено участнику спора.', 'warning')} /></div>
            </Panel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <Card title="Сделка" value={dispute.dealId} subtitle="Связанный объект" />
              <Card title="Удержание" value={formatCompactMoney(dispute.holdAmount)} subtitle="Сумма заморожена до решения" />
              <Card title="Дедлайн" value={`${dispute.slaDaysLeft} дн.`} subtitle="Сколько осталось на разбор" />
              <Card title="Пакет доказательств" value={`${dispute.evidence.uploaded}/${dispute.evidence.total}`} subtitle="Степень готовности к решению" />
            </div>
            <Panel title="Действия по спору" subtitle="Пакет доказательств и быстрый переход в связанную сделку.">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn label="Сформировать пакет доказательств" onClick={() => downloadFile(`evidence-pack-${dispute.id}.txt`, `Пакет доказательств\nСпор: ${dispute.id}\nСделка: ${dispute.dealId}\nПричина: ${dispute.reasonCode}\nУдержание: ${dispute.holdAmount}`)} />
                <Btn label="Открыть сделку" href={`/platform-v7/deals/${dispute.dealId}`} />
              </div>
            </Panel>
          </div>
        ) : <Panel title="Спор не найден" subtitle={`Спор ${second} не существует или недоступен.`}><Btn label="Вернуться к списку" href="/platform-v7/disputes" /></Panel>
      )}

      {first === 'compliance' && (
        <Panel title="Комплаенс и журнал действий" subtitle="Поиск по актору, периоду и объекту с выгрузкой в CSV." actions={<Btn label="Выгрузить CSV" onClick={() => downloadFile(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, ['Время,Актор,Действие,Тип,Объект', ...filteredAudit.map((entry) => `${entry.ts},${entry.actor},${entry.action},${entry.type},${entry.object ?? ''}`)].join('\n'), 'text/csv;charset=utf-8')} /> }>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input value={complianceSearch} onChange={(e) => setComplianceSearch(e.target.value)} placeholder="Поиск по действию, актору или объекту..." style={{ flex: 1, minWidth: 220, padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
            <select value={complianceActor} onChange={(e) => setComplianceActor(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }}><option value="">Все акторы</option>{Array.from(new Set(AUDIT_LOG.map((entry) => entry.actor))).map((actor) => <option key={actor} value={actor}>{actor}</option>)}</select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} />
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredAudit.map((entry, index) => (
              <div key={`${entry.ts}-${index}`} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                  <div><div style={{ fontSize: 11, color: '#6B778C' }}>Время</div><div style={{ fontSize: 13, fontWeight: 700 }}>{new Date(entry.ts).toLocaleString('ru-RU')}</div></div>
                  <div><div style={{ fontSize: 11, color: '#6B778C' }}>Актор</div><div style={{ fontSize: 13, fontWeight: 700 }}>{entry.actor}</div></div>
                  <div><div style={{ fontSize: 11, color: '#6B778C' }}>Тип</div><Badge tone={entry.type === 'danger' ? 'danger' : entry.type === 'warning' ? 'warning' : 'success'}>{entry.type}</Badge></div>
                  <div><div style={{ fontSize: 11, color: '#6B778C' }}>Объект</div><div style={{ fontSize: 13, fontWeight: 700 }}>{entry.object ?? '—'}</div></div>
                </div>
                <div style={{ fontSize: 13, color: '#0F1419', marginTop: 10 }}>{entry.action}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {first === 'procurement' && (
        <Panel title="Закупки" subtitle="Пошаговое создание запроса на закупку и список активных запросов.">
          <div style={{ padding: 16, borderRadius: 16, background: '#F8FAFB', border: '1px solid #E4E6EA', marginBottom: 14 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800, color: '#6B778C' }}>Шаг {rfqStep} из 4</div>
            {rfqStep === 1 ? <div style={{ display: 'grid', gap: 10, marginTop: 12 }}><input value={rfqForm.grain} onChange={(e) => setRfqForm({ ...rfqForm, grain: e.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} /><input value={rfqForm.volume} onChange={(e) => setRfqForm({ ...rfqForm, volume: e.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} /></div> : null}
            {rfqStep === 2 ? <div style={{ display: 'grid', gap: 10, marginTop: 12 }}><input value={rfqForm.region} onChange={(e) => setRfqForm({ ...rfqForm, region: e.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} /><input value={rfqForm.payment} onChange={(e) => setRfqForm({ ...rfqForm, payment: e.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} /></div> : null}
            {rfqStep === 3 ? <div style={{ display: 'grid', gap: 10, marginTop: 12 }}><input value={rfqForm.quality} onChange={(e) => setRfqForm({ ...rfqForm, quality: e.target.value })} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid #E4E6EA' }} /></div> : null}
            {rfqStep === 4 ? <div style={{ marginTop: 12, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{rfqForm.grain} · {rfqForm.volume} т · {rfqForm.region} · {rfqForm.payment} · {rfqForm.quality}</div> : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}><Btn label="Назад" onClick={() => setRfqStep((prev) => Math.max(1, prev - 1))} /><Btn label={rfqStep < 4 ? 'Далее' : 'Сохранить'} tone="success" onClick={() => { if (rfqStep < 4) setRfqStep((prev) => prev + 1); else notify('Запрос на закупку сохранён в демо-контуре.'); }} /></div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {RFQ_LIST.map((rfq) => (
              <div key={rfq.id} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
                <div><div style={{ fontSize: 15, fontWeight: 800 }}>{rfq.id} · {rfq.grain}</div><div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>{rfq.volume} т · {rfq.region}</div></div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{formatMoney(rfq.price)} / т</div>
                <div style={{ fontSize: 12, color: '#6B778C' }}>{rfq.quality}</div>
                <Btn label="Подать предложение" onClick={() => notify(`По ${rfq.id} добавлено предложение.`)} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {first === 'analytics' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card title="Спорность" value="8%" subtitle="Доля сделок, где включилось удержание" />
            <Card title="Средний чек" value="4,2 млн ₽" subtitle="Средний размер сделки" />
            <Card title="Скорость закрытия" value="8,3 дня" subtitle="Среднее время от сделки до расчёта" />
            <Card title="Сделок в апреле" value="31" subtitle="Пик по текущему ряду" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <Panel title="Сделки по месяцам" subtitle="Сколько сделок прошло через контур."><div style={{ display: 'grid', gap: 10 }}>{['Янв · 12', 'Фев · 18', 'Мар · 24', 'Апр · 31'].map((line) => <div key={line} style={{ padding: '12px 14px', borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 13, fontWeight: 700 }}>{line}</div>)}</div></Panel>
            <Panel title="Оборот по месяцам" subtitle="Деньги, которые прошли через платформенный контур."><div style={{ display: 'grid', gap: 10 }}>{['Янв · 45 млн ₽', 'Фев · 67 млн ₽', 'Мар · 91 млн ₽', 'Апр · 118 млн ₽'].map((line) => <div key={line} style={{ padding: '12px 14px', borderRadius: 14, background: '#F8FAFB', border: '1px solid #E4E6EA', fontSize: 13, fontWeight: 700 }}>{line}</div>)}</div></Panel>
          </div>
        </div>
      )}

      {!['control-tower', 'deals', 'seller', 'buyer', 'logistics', 'field', 'bank', 'disputes', 'compliance', 'procurement', 'analytics', 'driver', 'surveyor', 'elevator', 'lab', 'arbitrator', 'roles'].includes(first) ? <Panel title="Экран не найден" subtitle="Такого маршрута пока нет в демо-контуре."><Btn label="Открыть центр управления" href="/platform-v7/control-tower" /></Panel> : null}
    </div>
  );
}
