'use client';

import * as React from 'react';
import Link from 'next/link';
import type { DomainDeal, DomainDealStatus } from '@/lib/domain/types';
import { SANDBOX_INCIDENTS, SANDBOX_LOGISTICS_ORDERS } from '@/lib/platform-v7/logistics-chain';
import { FactSourceBadge } from '@/components/platform-v7/FactSourceBadge';
import type { P7WorkspaceRuntimeBinding } from '@/lib/platform-v7/deal-workspace-runtime-binding';
import { P7DealWorkspaceRuntimeActionButton } from '@/components/platform-v7/P7DealWorkspaceRuntimeActionButton';
import {
  buildP7DealWorkspaceRuntimeIntents,
  p7DealWorkspaceRuntimeIntentById,
  type P7DealWorkspaceRuntimeIntent,
} from '@/lib/platform-v7/deal-workspace-runtime-intents';

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
  { id: 'overview', label: 'Что делать' },
  { id: 'money', label: 'Деньги' },
  { id: 'logistics', label: 'Рейс' },
  { id: 'documents', label: 'Документы' },
  { id: 'fgis', label: 'ФГИС' },
  { id: 'evidence', label: 'Доказательства' },
  { id: 'dispute', label: 'Спор' },
];

const DOC_READY_STATUSES = new Set<DomainDealStatus>(['docs_complete', 'release_requested', 'release_approved', 'closed']);
const LOGISTICS_READY_STATUSES = new Set<DomainDealStatus>(['arrived', 'unloading_started', 'unloading_done', 'quality_check', 'quality_approved', 'quality_disputed', 'docs_complete', 'release_requested', 'release_approved', 'closed']);
const ACCEPTANCE_READY_STATUSES = new Set<DomainDealStatus>(['unloading_done', 'quality_check', 'quality_approved', 'quality_disputed', 'docs_complete', 'release_requested', 'release_approved', 'closed']);
const QUALITY_READY_STATUSES = new Set<DomainDealStatus>(['quality_approved', 'docs_complete', 'release_requested', 'release_approved', 'closed']);

function money(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
}

function blockerText(deal: DomainDeal): string {
  return deal.blockers.join(' ').toLowerCase();
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function domainDealMoneyBlockers(deal: DomainDeal): string[] {
  const text = blockerText(deal);
  const bankBasisAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const blockers: string[] = [];

  if (deal.reservedAmount <= 0) blockers.push('no-reserved-money');
  if (bankBasisAmount <= 0) blockers.push('no-bank-basis-amount');
  if (deal.holdAmount > 0) blockers.push('active-hold');
  if (deal.dispute || hasAny(text, ['dispute', 'спор', 'арбитраж'])) blockers.push('open-dispute');
  if (!DOC_READY_STATUSES.has(deal.status) || hasAny(text, ['docs', 'document', 'документ', 'эдо'])) blockers.push('documents-not-ready');
  if (hasAny(text, ['fgis', 'фгис', 'sdiz', 'сдиз'])) blockers.push('fgis-not-ready');
  if (!LOGISTICS_READY_STATUSES.has(deal.status) || hasAny(text, ['transport', 'logistics', 'логист', 'рейс', 'этрн'])) blockers.push('transport-not-ready');
  if (!ACCEPTANCE_READY_STATUSES.has(deal.status) || hasAny(text, ['acceptance', 'прием', 'приём', 'вес'])) blockers.push('acceptance-not-confirmed');
  if (!QUALITY_READY_STATUSES.has(deal.status) || hasAny(text, ['quality', 'lab', 'лаборатор', 'качест'])) blockers.push('quality-not-approved');
  if (deal.blockers.length > 0) blockers.push('manual-blocker');

  return [...new Set(blockers)];
}

function runtimeIntentsFor(deal: DomainDeal, bankBasisBlockedReason: string | null): readonly P7DealWorkspaceRuntimeIntent[] {
  const bankBasisAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const bankBasisBlocked = domainDealMoneyBlockers(deal).length > 0;

  return buildP7DealWorkspaceRuntimeIntents({
    dealId: deal.id,
    bankBasisAmount,
    bankBasisBlocked,
    bankBasisBlockedReason,
    documentsBlocked: deal.blockers.includes('docs'),
    disputeOpen: Boolean(deal.dispute),
  });
}

export function P7DealWorkspaceTabs({ deal, runtimeBinding }: { deal: DomainDeal; runtimeBinding?: P7WorkspaceRuntimeBinding }) {
  const [active, setActive] = React.useState<Tab>('overview');
  const order = SANDBOX_LOGISTICS_ORDERS.find((item) => item.dealId === deal.id) ?? null;
  const incidents = order ? SANDBOX_INCIDENTS.filter((item) => item.logisticsOrderId === order.id && (item.status === 'open' || item.status === 'under_review')) : [];
  const blockers = deal.blockers.length + (deal.holdAmount > 0 ? 1 : 0) + incidents.length;

  return (
    <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${B}`, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Рабочая зона сделки · runtime-контур</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900, color: T }}>Понятный центр управления сделкой</div>
          {runtimeBinding ? <div style={{ marginTop: 4, fontSize: 13, color: M, lineHeight: 1.45 }}>{runtimeBinding.nextStepTitle}: {runtimeBinding.nextStepInstruction}</div> : null}
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: blockers > 0 ? ERR_BG : BRAND_BG, border: `1px solid ${blockers > 0 ? ERR_BORDER : BRAND_BORDER}`, color: blockers > 0 ? ERR : BRAND }}>
          {blockers > 0 ? `${blockers} блок.` : 'красных блокеров нет'}
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
        {active === 'overview' ? <Overview deal={deal} runtimeBinding={runtimeBinding} /> : null}
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

function Overview({ deal, runtimeBinding }: { deal: DomainDeal; runtimeBinding?: P7WorkspaceRuntimeBinding }) {
  return (
    <Stack>
      <p style={{ margin: 0, fontSize: 13, color: M, lineHeight: 1.6 }}>Один объект сделки связывает цену, логистику, приёмку, документы, деньги, спор и доказательства. Пользователь видит не набор разделов, а ответ: что происходит, что мешает и какой следующий безопасный шаг.</p>
      {runtimeBinding ? <Notice danger={runtimeBinding.blocked} title='Главная подсказка'>{runtimeBinding.nextStepInstruction}</Notice> : null}
      <FactRail items={['sber_safe_deals', 'fgis_grain', 'logistics_sphere']} />
      <Grid>
        <Cell label='Сделка' value={deal.id} mono />
        <Cell label='Культура' value={deal.grain} />
        <Cell label='Объём' value={`${deal.quantity} ${deal.unit}`} />
        <Cell label='Статус' value={runtimeBinding?.statusLabel ?? deal.status} />
        <Cell label='Продавец' value={deal.seller.name} />
        <Cell label='Покупатель' value={deal.buyer.name} />
      </Grid>
    </Stack>
  );
}

function Money({ deal }: { deal: DomainDeal }) {
  const bankBasisAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const blockerLabels = domainDealMoneyBlockers(deal);
  const bankBasisBlocked = blockerLabels.length > 0;
  const bankBasisBlockedReason = bankBasisBlocked ? 'Сначала закройте всю матрицу сделки: ФГИС, качество, документы, логистику, спор и банк.' : null;
  const intent = p7DealWorkspaceRuntimeIntentById(runtimeIntentsFor(deal, bankBasisBlockedReason), 'request_bank_basis');

  return (
    <Stack>
      <FactRail items={['sber_safe_deals']} />
      <Grid>
        <Cell label='Зарезервировано' value={money(deal.reservedAmount)} color={MONEY} />
        <Cell label='Удержано' value={money(deal.holdAmount)} danger={deal.holdAmount > 0} />
        <Cell label='К банковскому основанию' value={money(bankBasisAmount)} color={bankBasisBlocked ? M : BRAND} />
      </Grid>
      <Notice danger={bankBasisBlocked} title={bankBasisBlocked ? 'Банковское основание заблокировано' : 'Можно готовить банковское основание'}>
        {bankBasisBlocked ? 'Не закрыта полная матрица: резерв, сумма, удержание, документы, ФГИС/СДИЗ, рейс, приёмка, качество, спор и ручные остановки.' : 'Можно подготовить основание для банка; это ещё не движение денег и не подтверждение внешнего банка.'}
      </Notice>
      <RuntimeActionRow>
        <P7DealWorkspaceRuntimeActionButton dealId={deal.id} intent={intent} />
        <Link href='/platform-v7/bank' style={linkButton()}>Банковый контур →</Link>
      </RuntimeActionRow>
    </Stack>
  );
}

function Logistics({ deal }: { deal: DomainDeal }) {
  const order = SANDBOX_LOGISTICS_ORDERS.find((item) => item.dealId === deal.id) ?? null;
  const incidents = order ? SANDBOX_INCIDENTS.filter((item) => item.logisticsOrderId === order.id && (item.status === 'open' || item.status === 'under_review')) : [];
  if (!order) return <Empty text={`Для ${deal.id} нет привязанного логистического заказа.`} href='/platform-v7/logistics' />;

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
  const intent = p7DealWorkspaceRuntimeIntentById(runtimeIntentsFor(deal, null), 'start_document_review');
  return (
    <Stack>
      <FactRail items={['edo_saby', 'fgis_grain']} />
      <Notice danger={missing} title={missing ? 'Документы блокируют банковское основание' : 'Критичных пробелов нет'}>{missing ? 'Недостающие документы блокируют подготовку банковского основания.' : 'Документный слой не красный для текущего этапа.'}</Notice>
      <Grid>
        <Cell label='Договор' value='подписан в ручном контуре' color={BRAND} />
        <Cell label='СДИЗ' value={deal.blockers.includes('fgis') ? 'ручная проверка' : 'связан с контуром'} danger={deal.blockers.includes('fgis')} />
        <Cell label='ЭТрН' value={deal.blockers.includes('transport') ? 'требуется документ' : 'подписан в контуре'} danger={deal.blockers.includes('transport')} />
      </Grid>
      <RuntimeActionRow>
        <P7DealWorkspaceRuntimeActionButton dealId={deal.id} intent={intent} />
        <Link href={`/platform-v7/deals/${deal.id}/documents`} style={linkButton()}>Документы сделки →</Link>
      </RuntimeActionRow>
    </Stack>
  );
}

function Fgis({ deal }: { deal: DomainDeal }) {
  const blocked = deal.blockers.includes('fgis');
  return (
    <Stack>
      <FactRail items={['fgis_grain']} />
      <Notice danger={blocked} title='ФГИС ЗЕРНО'>{blocked ? 'Синхронизация партии требует проверки. Промышленный контур ФГИС не заявлен.' : 'Партия связана с контуром сделки на уровне подготовленной модели. Промышленный контур ФГИС не заявлен.'}</Notice>
    </Stack>
  );
}

function Evidence({ deal }: { deal: DomainDeal }) {
  const weak = deal.blockers.length > 0 || deal.holdAmount > 0;
  return (
    <Stack>
      <FactRail items={['gps_wialon', 'fgis_grain', 'sber_safe_deals']} />
      <Notice danger={weak} title='Пакет доказательств'>{weak ? 'Пакет доказательств требует усиления перед спором или банковским основанием.' : 'Пакет доказательств достаточен для текущей ручной модели.'}</Notice>
      <Grid>
        <Cell label='Фото' value='3 файла в контуре' color={EVIDENCE} />
        <Cell label='Качество' value='протокол в контуре' color={EVIDENCE} />
        <Cell label='Банк' value='ожидает внешнее событие' color={EVIDENCE} />
      </Grid>
    </Stack>
  );
}

function Dispute({ deal }: { deal: DomainDeal }) {
  const hasHold = deal.holdAmount > 0;
  const intent = p7DealWorkspaceRuntimeIntentById(runtimeIntentsFor(deal, null), 'open_dispute');
  return (
    <Stack>
      <Notice danger={hasHold} title={hasHold ? 'Активное удержание' : 'Спора нет'}>{hasHold ? `${money(deal.holdAmount)} удержано до решения.` : 'По сделке нет активного удержания.'}</Notice>
      <RuntimeActionRow>
        <P7DealWorkspaceRuntimeActionButton dealId={deal.id} intent={intent} />
        <Link href='/platform-v7/disputes' style={linkButton('danger')}>Арбитражный кабинет →</Link>
      </RuntimeActionRow>
    </Stack>
  );
}

function RuntimeActionRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, alignItems: 'start' }}>{children}</div>;
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
