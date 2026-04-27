'use client';

import * as React from 'react';
import Link from 'next/link';
import type { DomainDeal } from '@/lib/domain/types';
import { SANDBOX_LOGISTICS_ORDERS, SANDBOX_INCIDENTS } from '@/lib/platform-v7/logistics-chain';
import { formatCompactMoney } from '@/lib/v7r/helpers';

// ─── palette ────────────────────────────────────────────────────────────────
const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const WARN = '#B45309';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';
const ERR = '#B91C1C';
const MONEY = '#155EEF';
const MONEY_BG = 'rgba(21,94,239,0.06)';
const MONEY_BORDER = 'rgba(21,94,239,0.18)';
const EVIDENCE = '#6941C6';
const EVIDENCE_BG = 'rgba(105,65,198,0.06)';
const EVIDENCE_BORDER = 'rgba(105,65,198,0.18)';

type Tab = 'overview' | 'money' | 'logistics' | 'documents' | 'fgis' | 'evidence' | 'dispute';

interface TabDef {
  id: Tab;
  label: string;
  badge?: number;
  danger?: boolean;
}

// ─── component ────────────────────────────────────────────────────────────────

export function P7DealWorkspaceTabs({ deal }: { deal: DomainDeal }) {
  const [activeTab, setActiveTab] = React.useState<Tab>('overview');

  // Compute badge counts
  const logisticsOrder = SANDBOX_LOGISTICS_ORDERS.find((o) => o.dealId === deal.id);
  const logisticsIncidents = logisticsOrder
    ? SANDBOX_INCIDENTS.filter((i) => i.logisticsOrderId === logisticsOrder.id && (i.status === 'open' || i.status === 'under_review'))
    : [];

  const hasDispute = deal.holdAmount > 0;
  const hasDocBlocker = deal.blockers.includes('docs');
  const hasTransportBlocker = deal.blockers.includes('transport');

  const TABS: TabDef[] = [
    { id: 'overview', label: 'Обзор' },
    { id: 'money', label: 'Деньги', badge: deal.holdAmount > 0 ? 1 : 0, danger: deal.holdAmount > 0 },
    { id: 'logistics', label: 'Логистика', badge: logisticsIncidents.length, danger: logisticsIncidents.length > 0 || hasTransportBlocker },
    { id: 'documents', label: 'Документы', badge: hasDocBlocker ? 1 : 0, danger: hasDocBlocker },
    { id: 'fgis', label: 'ФГИС' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'dispute', label: 'Спор', badge: hasDispute ? 1 : 0, danger: hasDispute },
  ];

  return (
    <div style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${B}`, overflowX: 'auto', padding: '0 16px' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '14px 16px',
                fontSize: 13,
                fontWeight: 700,
                color: isActive ? BRAND : M,
                borderBottom: isActive ? `2px solid ${BRAND}` : '2px solid transparent',
                whiteSpace: 'nowrap',
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              {tab.label}
              {(tab.badge ?? 0) > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: 99,
                  fontSize: 10,
                  fontWeight: 900,
                  background: tab.danger ? ERR : WARN,
                  color: '#fff',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: 18 }}>
        {activeTab === 'overview' && <OverviewTab deal={deal} />}
        {activeTab === 'money' && <MoneyTab deal={deal} />}
        {activeTab === 'logistics' && <LogisticsTab deal={deal} logisticsOrder={logisticsOrder ?? null} incidents={logisticsIncidents} />}
        {activeTab === 'documents' && <DocumentsTab deal={deal} />}
        {activeTab === 'fgis' && <FgisTab deal={deal} />}
        {activeTab === 'evidence' && <EvidenceTab deal={deal} />}
        {activeTab === 'dispute' && <DisputeTab deal={deal} />}
      </div>
    </div>
  );
}

// ─── tab panels ──────────────────────────────────────────────────────────────

function OverviewTab({ deal }: { deal: DomainDeal }) {
  const blockerLabels: Record<string, string> = {
    docs: 'Неполный пакет документов',
    transport: 'Транспортный gate не очищен',
    dispute: 'Активный спор или удержание',
    bank: 'Банк ожидает действия',
    fgis: 'ФГИС синхронизация не завершена',
    quality: 'Качество под вопросом',
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: M, lineHeight: 1.5 }}>
        Центральный объект сделки. Все модули (деньги, логистика, документы, ФГИС, evidence, спор) — дочерние контуры этой сделки.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
        <Cell label='Сделка' value={deal.id} mono />
        <Cell label='Статус' value={deal.status} />
        <Cell label='Культура' value={deal.grain} />
        <Cell label='Объём' value={`${deal.quantity} ${deal.unit}`} />
        <Cell label='В резерве' value={formatCompactMoney(deal.reservedAmount)} money />
        <Cell label='Удержано' value={formatCompactMoney(deal.holdAmount)} danger={deal.holdAmount > 0} />
      </div>
      {deal.blockers.length > 0 && (
        <div style={{ background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: ERR, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Блокеры</div>
          {deal.blockers.map((bl) => (
            <div key={bl} style={{ fontSize: 13, color: ERR }}>· {blockerLabels[bl] ?? bl}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoneyTab({ deal }: { deal: DomainDeal }) {
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
  const releaseReady = deal.status === 'release_requested' || deal.status === 'docs_complete';
  const releaseBlocked = deal.blockers.length > 0 || deal.holdAmount > 0;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <MoneyCell label='Зарезервировано' value={fmt(deal.reservedAmount)} color={MONEY} />
        <MoneyCell label='Удержано' value={fmt(deal.holdAmount)} color={deal.holdAmount > 0 ? ERR : M} />
        <MoneyCell
          label='К выпуску'
          value={fmt(deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0))}
          color={releaseBlocked ? M : BRAND}
        />
      </div>

      <div style={{ background: releaseBlocked ? ERR_BG : BRAND_BG, border: `1px solid ${releaseBlocked ? ERR_BORDER : BRAND_BORDER}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: releaseBlocked ? ERR : BRAND, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Статус выпуска
        </div>
        <div style={{ fontSize: 14, color: T, marginTop: 6 }}>
          {releaseBlocked
            ? 'Выпуск заблокирован. Снимите блокеры перед запросом.'
            : releaseReady
              ? 'Сделка готова к выпуску.'
              : 'Сделка в процессе исполнения. Выпуск будет доступен после всех этапов.'}
        </div>
      </div>

      <div style={{ fontSize: 12, color: M }}>
        Для выпуска денег обязательны: документы ✓, транспортный gate ✓, нет активных споров ✓, банк подтвердил ✓.
        <Link href='/platform-v7/bank' style={{ marginLeft: 6, color: MONEY, fontWeight: 700, textDecoration: 'none' }}>Открыть банковый контур →</Link>
      </div>
    </div>
  );
}

function LogisticsTab({ deal, logisticsOrder, incidents }: {
  deal: DomainDeal;
  logisticsOrder: (typeof SANDBOX_LOGISTICS_ORDERS)[0] | null;
  incidents: typeof SANDBOX_INCIDENTS;
}) {
  if (!logisticsOrder) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 13, color: M }}>Логистический заказ для сделки {deal.id} не найден в sandbox-данных.</div>
        <Link href='/platform-v7/logistics' style={{ fontSize: 13, color: BRAND, fontWeight: 700, textDecoration: 'none' }}>
          Открыть диспетчерскую →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        <Cell label='Заказ' value={logisticsOrder.id} mono />
        <Cell label='Статус' value={logisticsOrder.status} />
        <Cell label='Объём' value={`${logisticsOrder.volumeTons} т`} />
        <Cell label='Перевозчик' value={logisticsOrder.carrierName ?? '—'} />
      </div>
      <div style={{ fontSize: 12, color: M }}>
        {logisticsOrder.originRegion} → {logisticsOrder.destinationRegion}
      </div>
      {incidents.length > 0 && (
        <div style={{ background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: ERR, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Инциденты ({incidents.length})</div>
          {incidents.map((inc) => (
            <div key={inc.id} style={{ fontSize: 13, color: ERR }}>· {inc.description}</div>
          ))}
        </div>
      )}
      <Link href='/platform-v7/logistics' style={{ fontSize: 13, color: BRAND, fontWeight: 700, textDecoration: 'none' }}>
        Открыть диспетчерскую →
      </Link>
    </div>
  );
}

function DocumentsTab({ deal }: { deal: DomainDeal }) {
  const hasDocBlocker = deal.blockers.includes('docs');
  const docs = [
    { name: 'Договор купли-продажи', required: true, status: 'signed' },
    { name: 'СДИЗ (из ФГИС)', required: true, status: deal.blockers.includes('fgis') ? 'missing' : 'uploaded' },
    { name: 'Транспортная накладная (ЭТрН)', required: true, status: deal.blockers.includes('transport') ? 'missing' : 'signed' },
    { name: 'Акт приёмки', required: true, status: deal.status === 'quality_approved' || deal.status === 'docs_complete' ? 'signed' : 'pending' },
    { name: 'Протокол качества', required: false, status: 'uploaded' },
  ];

  const docStatusColor = (s: string) => {
    if (s === 'signed') return BRAND;
    if (s === 'uploaded') return BRAND;
    if (s === 'missing') return ERR;
    if (s === 'pending') return WARN;
    return M;
  };
  const docStatusLabel = (s: string) => {
    if (s === 'signed') return 'Подписан';
    if (s === 'uploaded') return 'Загружен';
    if (s === 'missing') return 'Отсутствует';
    if (s === 'pending') return 'Ожидает';
    return s;
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {hasDocBlocker && (
        <div style={{ background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 10, padding: 12, fontSize: 13, color: ERR }}>
          Документный gate заблокирован. Выпуск денег невозможен до закрытия всех обязательных документов.
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {docs.map((doc) => (
          <div key={doc.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '10px 14px', background: SS, border: `1px solid ${B}`, borderRadius: 10 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{doc.name}</span>
              {doc.required && <span style={{ marginLeft: 6, fontSize: 10, color: ERR, fontWeight: 800 }}>ОБЯЗАТЕЛЬНЫЙ</span>}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: docStatusColor(doc.status) }}>
              {docStatusLabel(doc.status)}
            </span>
          </div>
        ))}
      </div>
      <Link href={`/platform-v7/deals/${deal.id}/documents`} style={{ fontSize: 13, color: BRAND, fontWeight: 700, textDecoration: 'none' }}>
        Открыть документы сделки →
      </Link>
    </div>
  );
}

function FgisTab({ deal }: { deal: DomainDeal }) {
  const hasFgisBlocker = deal.blockers.includes('fgis');
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: WARN_BG, border: `1px solid ${WARN_BORDER}`, color: WARN }}>
          sandbox
        </span>
        <span style={{ fontSize: 13, color: M }}>Реальных запросов к ФГИС ЗЕРНО не выполняется</span>
      </div>
      {hasFgisBlocker && (
        <div style={{ background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 10, padding: 12, fontSize: 13, color: ERR }}>
          ФГИС gate заблокирован. Синхронизация партии не завершена. Выпуск и приёмка заблокированы.
        </div>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {[
          { label: 'СДИЗ', value: hasFgisBlocker ? 'Не подтверждён' : 'СДИЗ-68-2025-0001', status: hasFgisBlocker ? 'missing' : 'ok' },
          { label: 'ФГИС синхронизация', value: hasFgisBlocker ? 'Ошибка' : 'Синхронизировано', status: hasFgisBlocker ? 'error' : 'ok' },
          { label: 'Продавец в ФГИС', value: 'Агро-Юг ООО · verified', status: 'ok' },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '10px 14px', background: SS, border: `1px solid ${B}`, borderRadius: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: row.status === 'ok' ? BRAND : row.status === 'error' ? ERR : WARN }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceTab({ deal }: { deal: DomainDeal }) {
  const evidenceItems = [
    { type: 'Фото погрузки', source: 'Водитель', trust: 'self_declared', count: 3 },
    { type: 'Протокол качества', source: 'Лаборатория', trust: 'provider_verified', count: 1 },
    { type: 'Банковое событие (резерв)', source: 'Банк', trust: 'provider_verified', count: 1 },
    { type: 'ЭТрН', source: 'СберКорус', trust: 'signed', count: 1 },
  ];
  const readiness = deal.holdAmount === 0 && !deal.blockers.includes('docs') ? 'high' : deal.blockers.length === 0 ? 'medium' : 'low';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{
          padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: readiness === 'high' ? BRAND_BG : readiness === 'medium' ? WARN_BG : ERR_BG,
          border: `1px solid ${readiness === 'high' ? BRAND_BORDER : readiness === 'medium' ? WARN_BORDER : ERR_BORDER}`,
          color: readiness === 'high' ? BRAND : readiness === 'medium' ? WARN : ERR,
        }}>
          Готовность evidence: {readiness === 'high' ? 'Высокая' : readiness === 'medium' ? 'Средняя' : 'Низкая'}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {evidenceItems.map((ev) => (
          <div key={ev.type} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '10px 14px', background: SS, border: `1px solid ${B}`, borderRadius: 10 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: T }}>{ev.type}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: M }}>· {ev.source}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: M }}>×{ev.count}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: ev.trust === 'signed' ? BRAND : ev.trust === 'provider_verified' ? EVIDENCE : M }}>
                {ev.trust === 'signed' ? 'Подписан' : ev.trust === 'provider_verified' ? 'Верифицирован' : 'Self-declared'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DisputeTab({ deal }: { deal: DomainDeal }) {
  const hasDispute = deal.holdAmount > 0;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {hasDispute ? (
        <>
          <div style={{ background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: ERR, textTransform: 'uppercase', marginBottom: 6 }}>Активное удержание</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: T }}>
              {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(deal.holdAmount)}
            </div>
            <div style={{ fontSize: 13, color: M, marginTop: 6 }}>
              Выпуск денег заблокирован до закрытия спора или снятия удержания.
            </div>
          </div>
          <Link href={`/platform-v7/disputes`} style={{ fontSize: 13, color: ERR, fontWeight: 700, textDecoration: 'none' }}>
            Открыть арбитражный кабинет →
          </Link>
        </>
      ) : (
        <div style={{ fontSize: 13, color: M }}>
          По данной сделке нет активных споров или удержаний.
        </div>
      )}
    </div>
  );
}

// ─── shared micro-components ─────────────────────────────────────────────────

function Cell({ label, value, mono = false, danger = false, money = false }: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
  money?: boolean;
}) {
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        marginTop: 4,
        color: danger ? ERR : money ? MONEY : T,
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value}
      </div>
    </div>
  );
}

function MoneyCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: MONEY_BG, border: `1px solid ${MONEY_BORDER}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 10, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}
