'use client';

import * as React from 'react';
import Link from 'next/link';
import type { DomainDeal } from '@/lib/domain/types';
import { SANDBOX_INCIDENTS, SANDBOX_LOGISTICS_ORDERS } from '@/lib/platform-v7/logistics-chain';
import { P7GuardedActionButton } from '@/components/platform-v7/P7GuardedActionButton';
import { FactSourceBadge } from '@/components/platform-v7/FactSourceBadge';
import { platformV7ActionTargetById } from '@/lib/platform-v7/action-targets';

const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const ERR_BG = 'rgba(220,38,38,0.08)';
const ERR_BORDER = 'rgba(220,38,38,0.18)';
const ERR = '#B91C1C';
const MONEY = '#155EEF';
const EVIDENCE = '#6941C6';

type Tab = 'overview' | 'money' | 'logistics' | 'documents' | 'fgis' | 'evidence' | 'dispute';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'money', label: 'Деньги' },
  { id: 'logistics', label: 'Логистика' },
  { id: 'documents', label: 'Документы' },
  { id: 'fgis', label: 'ФГИС' },
  { id: 'evidence', label: 'Доказательства' },
  { id: 'dispute', label: 'Спор' },
];

function money(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

export function P7DealWorkspaceTabs({ deal }: { deal: DomainDeal }) {
  const [active, setActive] = React.useState<Tab>('overview');
  const order = SANDBOX_LOGISTICS_ORDERS.find((item) => item.dealId === deal.id) ?? null;
  const incidents = order ? SANDBOX_INCIDENTS.filter((item) => item.logisticsOrderId === order.id && (item.status === 'open' || item.status === 'under_review')) : [];
  const blockers = deal.blockers.length + (deal.holdAmount > 0 ? 1 : 0) + incidents.length;

  return (
    <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${B}`, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Рабочая зона сделки · тестовый контур</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: T }}>Сделка как единый контур исполнения</div>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: blockers > 0 ? ERR_BG : BRAND_BG, border: `1px solid ${blockers > 0 ? ERR_BORDER : BRAND_BORDER}`, color: blockers > 0 ? ERR : BRAND }}>
          {blockers > 0 ? `${blockers} блок.` : 'без красных блокеров'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${B}`, padding: '0 12px' }}>
        {TABS.map((tab) => (
          <button key={tab.id} type='button' onClick={() => setActive(tab.id)} style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '13px 12px', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', color: active === tab.id ? BRAND : M, borderBottom: active === tab.id ? `2px solid ${BRAND}` : '2px solid transparent' }}>
            {tab.label}{tab.id === 'dispute' && deal.holdAmount > 0 ? <Badge>{1}</Badge> : null}{tab.id === 'logistics' && incidents.length > 0 ? <Badge>{incidents.length}</Badge> : null}{tab.id === 'documents' && deal.blockers.includes('docs') ? <Badge>{1}</Badge> : null}
          </button>
        ))}
      </div>

      <div style={{ padding: 18 }}>
        {active === 'overview' ? <Overview deal={deal} /> : null}
        {active === 'money' ? <Money deal={deal} /> : null}
        {active === 'logistics' ? <Logistics deal={deal} /> : null}
        {active === 'documents' ? <Documents deal={deal} /> : null}
        {active === 'fgis' ? <Fgis deal={deal} /> : null}
        {active === 'evidence' ? <Evidence deal={deal} /> : null}
        {active === 'dispute' ? <Dispute deal={deal} /> : null}
      </div>
    </section>
  );
}

function Overview({ deal }: { deal: DomainDeal }) {
  return (
    <Stack>
      <p style={{ margin: 0, fontSize: 13, color: M, lineHeight: 1.6 }}>Один объект сделки связывает цену, логистику, приёмку, документы, деньги, спор и доказательства. Боевые подключения не заявлены: экран показывает тестовый контур и источники фактов.</p>
      <FactRail items={['sber_safe_deals', 'fgis_grain', 'logistics_sphere']} />
      <Grid>
        <Cell label='Сделка' value={deal.id} mono />
        <Cell label='Культура' value={deal.grain} />
        <Cell label='Объём' value={`${deal.quantity} ${deal.unit}`} />
        <Cell label='Статус' value={deal.status} />
        <Cell label='Продавец' value={deal.seller.name} />
        <Cell label='Покупатель' value={deal.buyer.name} />
      </Grid>
    </Stack>
  );
}

function Money({ deal }: { deal: DomainDeal }) {
  const releaseTarget = platformV7ActionTargetById('deal-release-funds');
  const requestTarget = platformV7ActionTargetById('deal-request-release');
  const releaseBlocked = deal.blockers.length > 0 || deal.holdAmount > 0;
  const blockerLabels = [...deal.blockers, ...(deal.holdAmount > 0 ? ['active-hold'] : [])];

  return (
    <Stack>
      <FactRail items={['sber_safe_deals']} />
      <Grid>
        <Cell label='Зарезервировано' value={money(deal.reservedAmount)} color={MONEY} />
        <Cell label='Удержано' value={money(deal.holdAmount)} danger={deal.holdAmount > 0} />
        <Cell label='К выпуску' value={money(deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0))} color={releaseBlocked ? M : BRAND} />
      </Grid>
      <Notice danger={releaseBlocked} title={releaseBlocked ? 'Выпуск заблокирован' : 'Выпуск возможен только после проверки'}>
        {releaseBlocked ? 'Есть блокеры или удержание. Прямой выпуск денег невозможен.' : 'Выпуск денег остаётся под проверкой: резерв, документы, приёмка, качество, рейс и спор.'}
      </Notice>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {requestTarget ? <P7GuardedActionButton target={requestTarget} activeActionId={null} blocked={releaseBlocked} blockerLabels={blockerLabels} blockedLabel='Запрос заблокирован' blockedReason='Сначала снимите блокеры сделки.' /> : null}
        {releaseTarget ? <P7GuardedActionButton target={releaseTarget} activeActionId={null} blocked blockerLabels={['full-gate-matrix-required']} blockedLabel='Выпуск под контролем' blockedReason='Выпуск денег доступен только после полной контрольной проверки.' /> : null}
        <Link href='/platform-v7/bank' style={linkButton()}>Банковый контур →</Link>
      </div>
    </Stack>
  );
}

function Logistics({ deal }: { deal: DomainDeal }) {
  const order = SANDBOX_LOGISTICS_ORDERS.find((item) => item.dealId === deal.id) ?? null;
  const incidents = order ? SANDBOX_INCIDENTS.filter((item) => item.logisticsOrderId === order.id && (item.status === 'open' || item.status === 'under_review')) : [];
  if (!order) return <Empty text={`Для ${deal.id} нет тестового логистического заказа.`} href='/platform-v7/logistics' />;

  return (
    <Stack>
      <FactRail items={['logistics_sphere', 'gps_wialon']} />
      <Grid>
        <Cell label='Заказ' value={order.id} mono />
        <Cell label='Статус' value={order.status} />
        <Cell label='Маршрут' value={`${order.originRegion} → ${order.destinationRegion}`} />
        <Cell label='Перевозчик' value={order.carrierName ?? '—'} />
      </Grid>
      {incidents.length > 0 ? <Notice danger title={`Инциденты: ${incidents.length}`}>{incidents.map((item) => item.description).join(' · ')}</Notice> : null}
      <Link href='/platform-v7/logistics' style={linkButton()}>Открыть диспетчерскую →</Link>
    </Stack>
  );
}

function Documents({ deal }: { deal: DomainDeal }) {
  const missing = deal.blockers.includes('docs');
  return (
    <Stack>
      <FactRail items={['edo_saby', 'fgis_grain']} />
      <Notice danger={missing} title={missing ? 'Документы блокируют деньги' : 'Критичных пробелов нет'}>{missing ? 'Недостающие документы блокируют выпуск денег.' : 'Документный слой не красный для текущего этапа.'}</Notice>
      <Grid>
        <Cell label='Договор' value='тест: подписан' color={BRAND} />
        <Cell label='СДИЗ' value={deal.blockers.includes('fgis') ? 'ручная проверка' : 'тест: связан'} danger={deal.blockers.includes('fgis')} />
        <Cell label='ЭТрН' value={deal.blockers.includes('transport') ? 'требуется документ' : 'тест: подписан'} danger={deal.blockers.includes('transport')} />
      </Grid>
      <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkButton()}>Документы сделки →</Link>
    </Stack>
  );
}

function Fgis({ deal }: { deal: DomainDeal }) {
  const blocked = deal.blockers.includes('fgis');
  return (
    <Stack>
      <FactRail items={['fgis_grain']} />
      <Notice danger={blocked} title='ФГИС ЗЕРНО'>{blocked ? 'Синхронизация партии требует проверки. Боевой контур ФГИС не заявлен.' : 'Партия связана с контуром сделки в тестовом режиме. Боевой контур ФГИС не заявлен.'}</Notice>
    </Stack>
  );
}

function Evidence({ deal }: { deal: DomainDeal }) {
  const weak = deal.blockers.length > 0 || deal.holdAmount > 0;
  return (
    <Stack>
      <FactRail items={['gps_wialon', 'fgis_grain', 'sber_safe_deals']} />
      <Notice danger={weak} title='Пакет доказательств'>{weak ? 'Пакет доказательств требует усиления перед спором или выпуском денег.' : 'Пакет доказательств достаточен для тестового сценария.'}</Notice>
      <Grid>
        <Cell label='Фото' value='тест: 3 файла' color={EVIDENCE} />
        <Cell label='Качество' value='тест: протокол' color={EVIDENCE} />
        <Cell label='Банк' value='тестовое событие' color={EVIDENCE} />
      </Grid>
    </Stack>
  );
}

function Dispute({ deal }: { deal: DomainDeal }) {
  const openTarget = platformV7ActionTargetById('deal-open-dispute');
  const hasHold = deal.holdAmount > 0;
  return (
    <Stack>
      <Notice danger={hasHold} title={hasHold ? 'Активное удержание' : 'Спора нет'}>{hasHold ? `${money(deal.holdAmount)} удержано до решения.` : 'По сделке нет активного удержания.'}</Notice>
      {openTarget ? <P7GuardedActionButton target={openTarget} activeActionId={null} tone='danger' /> : null}
      <Link href='/platform-v7/disputes' style={linkButton('danger')}>Арбитражный кабинет →</Link>
    </Stack>
  );
}

function FactRail({ items }: { items: Array<'sber_safe_deals' | 'fgis_grain' | 'logistics_sphere' | 'gps_wialon' | 'edo_saby'> }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{items.map((provider) => <FactSourceBadge key={provider} provider={provider} />)}</div>;
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gap: 12 }}>{children}</div>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>{children}</div>;
}

function Cell({ label, value, mono = false, danger = false, color }: { label: string; value: string; mono?: boolean; danger?: boolean; color?: string }) {
  return (
    <div style={{ background: SS, border: `1px solid ${B}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: danger ? ERR : color ?? T, fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function Notice({ title, children, danger = false }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{ background: danger ? ERR_BG : BRAND_BG, border: `1px solid ${danger ? ERR_BORDER : BRAND_BORDER}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: danger ? ERR : BRAND, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function Empty({ text, href }: { text: string; href: string }) {
  return (
    <Stack>
      <div style={{ fontSize: 13, color: M }}>{text}</div>
      <Link href={href} style={linkButton()}>Открыть связанный контур →</Link>
    </Stack>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, borderRadius: 99, fontSize: 10, fontWeight: 900, background: ERR, color: '#fff' }}>{children}</span>;
}

function linkButton(tone: 'default' | 'danger' = 'default'): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content', textDecoration: 'none', borderRadius: 12, padding: '10px 14px', background: tone === 'danger' ? ERR_BG : SS, border: `1px solid ${tone === 'danger' ? ERR_BORDER : B}`, color: tone === 'danger' ? ERR : T, fontSize: 13, fontWeight: 800 };
}
