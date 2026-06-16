'use client';

import Link from 'next/link';
import { SberKorusBadge } from '@/components/v7r/SberKorusBadge';
import { CALLBACKS, DEALS, getDealIntegrationState } from '@/lib/v7r/data';
import { formatCompactMoney, formatMoney, statusLabel } from '@/lib/v7r/helpers';
import {
  countTransportAwaitingSignatures,
  countTransportBlockedPacks,
  countTransportCompleted,
  getTransportHotlist,
  getTransportPackByDealId,
  getTransportSimulationScenario,
  moneyImpactLabel,
  transportPackStatusLabel,
  transportReleaseStateLabel,
} from '@/lib/v7r/transport-docs';
import { translateRole } from '@/lib/i18n/reason-codes';

function normalizeBankMoneyCopy(value: string | null | undefined) {
  return (value ?? '')
    .replace(/выпуск\s+денег/gi, 'банковское подтверждение')
    .replace(/выпуск/gi, 'банковский шаг')
    .replace(/release/gi, 'банковское подтверждение')
    .replace(/выплаты/gi, 'основания')
    .replace(/выплата/gi, 'основание');
}

function badge(status: 'ok' | 'pending' | 'mismatch') {
  if (status === 'ok') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'ОК' };
  if (status === 'pending') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'Ожидание' };
  return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'Расхождение' };
}

function callbackTypeLabel(type: string) {
  if (type === 'Reserve') return 'Резерв';
  if (type === 'Mismatch') return 'Расхождение';
  if (type === 'Release') return 'Банковское подтверждение';
  return normalizeBankMoneyCopy(type);
}

function describeBlocker(code: string) {
  switch (code) {
    case 'dispute':
    case 'DISPUTE_OPEN':
      return 'Спор открыт';
    case 'docs':
    case 'DOCS_MISSING':
      return 'Не хватает документов';
    case 'bank_confirm':
    case 'BANK_REVIEW_PENDING':
      return 'Нужно подтверждение банка';
    case 'lab_result':
      return 'Нет финального результата лаборатории';
    case 'reserve':
      return 'Резерв ещё не подтверждён';
    case 'FGIS_GATE_FAIL':
      return 'ФГИС блокирует банковский шаг';
    case 'ESIA_LINK_MISSING':
    case 'ESIA_REAUTH_REQUIRED':
      return 'Нужна связка с ЕСИА';
    case 'SYNC_CONFIRM_REQUIRED':
      return 'Нужна финальная сверка';
    case 'QUALITY_DISPUTE':
      return 'Есть спор по качеству';
    default:
      return normalizeBankMoneyCopy(code);
  }
}

function computeDealAction(dealId: string, blockers: string[], holdAmount: number, reservedAmount: number) {
  if (holdAmount > 0 || blockers.includes('dispute') || blockers.includes('DISPUTE_OPEN') || blockers.includes('QUALITY_DISPUTE')) {
    return { label: 'Эскроу', href: '/platform-v7/bank/escrow' };
  }
  if (blockers.includes('reserve') || reservedAmount > 0) {
    return { label: 'Факторинг', href: '/platform-v7/bank/factoring' };
  }
  if (blockers.includes('docs') || blockers.includes('DOCS_MISSING')) {
    return { label: 'Документы', href: `/platform-v7/deals/${dealId}/documents` };
  }
  return { label: 'Банк', href: '/platform-v7/bank' };
}

function SberBankLogo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: '#fff', border: '1px solid rgba(33,160,56,0.18)' }}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-label="Сбер" role="img">
        <defs>
          <linearGradient id="sberBankGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#21A038" />
            <stop offset="100%" stopColor="#00B8F0" />
          </linearGradient>
        </defs>
        <circle cx="17" cy="17" r="14" fill="none" stroke="url(#sberBankGradient)" strokeWidth="3" />
        <path d="M12 17.5l3 3 7-8" fill="none" stroke="#21A038" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'grid', gap: 2 }}>
        <div style={{ fontSize: 18, lineHeight: 1, fontWeight: 800, color: '#1F2937' }}>Сбер</div>
        <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)' }}>Контур банковской проверки</div>
      </div>
    </div>
  );
}

function brandPill(kind: 'sberApi' | 'sberBusinessId') {
  const token = kind === 'sberApi'
    ? { label: 'Сбер API', note: 'Банковский контур', accent: '#21A038', text: '#166534' }
    : { label: 'СберБизнес ID', note: 'Вход и верификация юрлица', accent: '#21A038', text: '#166534' };

  return (
    <span title={token.note} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'rgba(33,160,56,0.10)', border: '1px solid rgba(33,160,56,0.18)', color: token.text, fontSize: 11, fontWeight: 800 }}>
      <span aria-hidden style={{ display: 'inline-grid', placeItems: 'center', width: 18, height: 18, borderRadius: 999, background: token.accent, color: '#fff', fontSize: 10, fontWeight: 900 }}>S</span>
      {token.label}
    </span>
  );
}

function Card({ title, value, note, danger = false }: { title: string; value: string; note: string; danger?: boolean }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${danger ? '#FECACA' : 'var(--pc-border, #E4E6EA)'}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: danger ? '#991B1B' : 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: danger ? '#991B1B' : 'var(--pc-text-primary, #0F1419)', marginTop: 8, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6, marginTop: 8, wordBreak: 'break-word' }}>{note}</div>
    </section>
  );
}

function QueueCard({
  title,
  note,
  accent,
  rows,
}: {
  title: string;
  note: string;
  accent: { bg: string; border: string; color: string };
  rows: Array<{
    dealId: string;
    buyer: string;
    seller: string;
    status: string;
    reserved: number;
    hold: number;
    bankBasisAmount: number;
    blockers: string[];
    nextOwner: string | null;
    nextStep: string | null;
    action: { label: string; href: string };
  }>;
}) {
  return (
    <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: accent.bg, border: `1px solid ${accent.border}`, color: accent.color, fontSize: 11, fontWeight: 800, width: 'fit-content' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>{note}</div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.length ? rows.map((row) => (
          <div key={row.dealId} style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{row.dealId}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--pc-text-secondary, #475569)' }}>{row.seller} → {row.buyer}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #334155)', fontSize: 11, fontWeight: 800 }}>{row.status}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <div style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Резерв</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', marginTop: 6 }}>{formatCompactMoney(row.reserved)}</div>
              </div>
              <div style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>Удержание</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: row.hold > 0 ? '#991B1B' : 'var(--pc-text-primary, #0F1419)', marginTop: 6 }}>{formatCompactMoney(row.hold)}</div>
              </div>
              <div style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>К банковскому шагу</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', marginTop: 6 }}>{formatCompactMoney(row.bankBasisAmount)}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--pc-text-primary, #0F1419)' }}>Следующий владелец:</strong> {row.nextOwner ? translateRole(row.nextOwner) : '—'}<br />
              <strong style={{ color: 'var(--pc-text-primary, #0F1419)' }}>Следующий шаг:</strong> {normalizeBankMoneyCopy(row.nextStep) || 'Нужно уточнение оператором'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {row.blockers.length ? row.blockers.map((item) => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: 'rgba(15,20,25,0.04)', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #475569)', fontSize: 11, fontWeight: 700 }}>{normalizeBankMoneyCopy(item)}</span>
              )) : <span style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)' }}>Активных блокеров нет.</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/platform-v7/deals/${row.dealId}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 700 }}>Сделка</Link>
              <Link href={row.action.href} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: accent.bg, border: `1px solid ${accent.border}`, color: accent.color, fontSize: 12, fontWeight: 700 }}>{row.action.label}</Link>
              <Link href='/platform-v7/control-tower/hotlist' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 700 }}>Hotlist</Link>
            </div>
          </div>
        )) : <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)' }}>Пусто.</div>}
      </div>
    </section>
  );
}

export function BankRuntime() {
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const totalBankBasis = DEALS.reduce((sum, item) => sum + (item.releaseAmount ?? Math.max(item.reservedAmount - item.holdAmount, 0)), 0);
  const mismatchCount = CALLBACKS.filter((item) => item.status === 'mismatch').length;
  const pendingCount = CALLBACKS.filter((item) => item.status === 'pending').length;
  const transportBlocked = countTransportBlockedPacks();
  const transportAwaiting = countTransportAwaitingSignatures();
  const transportCompleted = countTransportCompleted();
  const transportHotlist = getTransportHotlist().slice(0, 3);
  const transportBankBasisDealPack = getTransportPackByDealId('DL-9109');
  const transportBankBasisScenario = getTransportSimulationScenario('DL-9109');
  const transportCurrentStep = transportBankBasisScenario?.steps[transportBankBasisScenario.currentStepIndex];

  const dealMoneyRows = DEALS.map((deal) => {
    const integration = getDealIntegrationState(deal.id, deal.lotId);
    const blockers = [...new Set([...deal.blockers, ...integration.reasonCodes].map(describeBlocker))];
    const bankBasisAmount = integration.gateState === 'FAIL' ? 0 : (deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0));
    return {
      dealId: deal.id,
      buyer: deal.buyer.name,
      seller: deal.seller.name,
      status: statusLabel(deal.status),
      reserved: deal.reservedAmount,
      hold: deal.holdAmount,
      bankBasisAmount,
      blockers,
      nextOwner: integration.nextOwner,
      nextStep: integration.nextStep,
      action: computeDealAction(deal.id, [...deal.blockers, ...integration.reasonCodes], deal.holdAmount, deal.reservedAmount),
    };
  });

  const bankReviewQueue = dealMoneyRows
    .filter((row) => row.bankBasisAmount > 0 || row.blockers.some((item) => item.includes('банк') || item.includes('сверка') || item.includes('документ')))
    .sort((a, b) => b.bankBasisAmount - a.bankBasisAmount)
    .slice(0, 4);

  const holdQueue = dealMoneyRows
    .filter((row) => row.hold > 0 || row.blockers.some((item) => item.includes('Спор') || item.includes('ФГИС') || item.includes('ЕСИА')))
    .sort((a, b) => b.hold - a.hold)
    .slice(0, 4);

  const prepQueue = dealMoneyRows
    .filter((row) => row.blockers.some((item) => item.includes('Резерв') || item.includes('лаборатории') || item.includes('документ')))
    .sort((a, b) => b.reserved - a.reserved)
    .slice(0, 4);

  const factoringCount = DEALS.filter((deal) => deal.status === 'payment_reserved' || deal.status === 'contract_signed').length;
  const escrowCount = DEALS.filter((deal) => deal.holdAmount > 0 || deal.status === 'quality_disputed').length;

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0', maxWidth: '100%', overflowX: 'hidden' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', wordBreak: 'break-word' }}>Банковый контур</div>
              <SberBankLogo />
            </div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8, maxWidth: 920, wordBreak: 'break-word' }}>Единый хаб исполнения: деньги, блокеры, владелец следующего шага и прямой переход в нужный контур сделки. Платформа фиксирует основание; внешнее банковское подтверждение выполняет банк.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {brandPill('sberBusinessId')}
            {brandPill('sberApi')}
            <div data-local-scenario="true" style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>Локальные данные</div>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Card title='В резерве' value={formatCompactMoney(totalReserved)} note='Деньги подтверждены и заведены в контур.' />
        <Card title='Под удержанием' value={formatCompactMoney(totalHold)} note='Споры, документы и ручные проверки.' danger={totalHold > 0} />
        <Card title='К банковскому шагу' value={formatCompactMoney(totalBankBasis)} note='Сумма основания, которую банк может проверить после закрытия блокеров.' />
        <Card title='Требуют внимания' value={String(mismatchCount + pendingCount)} note='События банка, которые ещё не доведены до конца.' danger={mismatchCount + pendingCount > 0} />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Факторинг</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>Buyer-side слой для сделок, где деньги ещё не готовы или нужен лимит перед исполнением.</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{factoringCount}</div>
          <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)' }}>Сделок сейчас в зоне предфинансирования или подтверждения резерва.</div>
          <Link href='/platform-v7/bank/factoring' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, padding: '10px 14px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', color: '#2563EB', fontSize: 13, fontWeight: 800 }}>Открыть факторинг</Link>
        </section>

        <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Эскроу</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>Контур удержания по спору, качеству, документам и событию банка.</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{escrowCount}</div>
          <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)' }}>Сделок сейчас прямо завязаны на удержание или спорный кейс.</div>
          <Link href='/platform-v7/bank/escrow' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, padding: '10px 14px', background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 13, fontWeight: 800 }}>Открыть эскроу</Link>
        </section>

        <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Control Tower</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>Операторский выход для снятия блокеров, когда проблема уже не про страницу банка, а про сделку целиком.</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{holdQueue.length + prepQueue.length}</div>
          <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)' }}>Денежных кейсов прямо сейчас требуют кросс-модульного добивания.</div>
          <Link href='/platform-v7/control-tower/hotlist' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 800 }}>Открыть hotlist</Link>
        </section>
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        <QueueCard
          title='Очередь банковской проверки основания'
          note='Сделки, где основание почти собрано, но ещё может застрять на банке, документах или финальной сверке.'
          accent={{ bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F' }}
          rows={bankReviewQueue}
        />
        <QueueCard
          title='Очередь удержаний и споров'
          note='Сделки, где деньги под риском и требуют эскроу-логики, арбитража или ручного закрытия блокера.'
          accent={{ bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C' }}
          rows={holdQueue}
        />
        <QueueCard
          title='Очередь подготовки основания'
          note='Сделки, которые ещё требуют резерва, лаборатории или документной сборки до банковского шага.'
          accent={{ bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)', color: '#2563EB' }}
          rows={prepQueue}
        />
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Transport gate через СберКорус</div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6 }}>Банк видит транспортный документный контур как отдельный стоп-фактор. Пока пакет не закрыт у СберКорус, финальное банковское подтверждение нельзя считать безопасным.</div>
          </div>
          <SberKorusBadge subtitle='Транспортные документы и подписи' compact />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Card title='Красный stop' value={String(transportBlocked)} note='Пакеты, которые прямо блокируют банковское подтверждение.' danger={transportBlocked > 0} />
          <Card title='Ждём подписи' value={String(transportAwaiting)} note='Рейсы, где контур СберКорус ещё не закрыт.' danger={transportAwaiting > 0} />
          <Card title='Зелёный контур' value={String(transportCompleted)} note='Пакеты, которые больше не спорят с банковским основанием.' />
        </div>

        {transportBankBasisDealPack && transportCurrentStep ? (
          <section style={{ background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{transportBankBasisDealPack.providerPackId}</div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>DL-9109 · зелёный сценарий банковской проверки</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>{transportPackStatusLabel(transportBankBasisDealPack.status)} · {normalizeBankMoneyCopy(moneyImpactLabel(transportBankBasisDealPack.moneyImpactStatus))}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #334155)', lineHeight: 1.65 }}><strong style={{ color: 'var(--pc-text-primary, #0F1419)' }}>{transportCurrentStep.label}.</strong> {normalizeBankMoneyCopy(transportCurrentStep.detail)}</div>
            <div style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 800 }}>{normalizeBankMoneyCopy(transportReleaseStateLabel(transportCurrentStep.releaseState))} · {normalizeBankMoneyCopy(transportCurrentStep.releaseReason)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href='/platform-v7/deals/DL-9109/transport-documents' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700 }}>Открыть пакет СберКорус</Link>
              <Link href='/platform-v7/deals/DL-9109/transport-documents/simulation' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 13, fontWeight: 700 }}>Открыть проверочный сценарий</Link>
            </div>
          </section>
        ) : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {transportHotlist.map((item) => (
            <div key={item.id} style={{ background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.pack.providerPackId}</div>
                  <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.pack.dealId} · {transportPackStatusLabel(item.pack.status)}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: item.severity === 'red' ? 'rgba(220,38,38,0.08)' : item.severity === 'amber' ? 'rgba(217,119,6,0.08)' : 'rgba(10,122,95,0.08)', border: '1px solid var(--pc-border, #E4E6EA)', color: item.severity === 'red' ? '#B91C1C' : item.severity === 'amber' ? '#B45309' : '#0A7A5F', fontSize: 11, fontWeight: 800 }}>{normalizeBankMoneyCopy(moneyImpactLabel(item.pack.moneyImpactStatus))}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}>{normalizeBankMoneyCopy(item.reason)}</div>
              <Link href={`/platform-v7/deals/${item.pack.dealId}/transport-documents`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 700, width: 'fit-content' }}>Открыть транспортный пакет</Link>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Банковские события</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {CALLBACKS.map((event) => {
            const tone = event.status === 'ok' ? 'ok' : event.status === 'pending' ? 'pending' : 'mismatch';
            const b = badge(tone);
            return (
              <div key={event.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: 14, border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13, color: 'var(--pc-text-primary, #0F1419)', wordBreak: 'break-word' }}>{event.id} · {event.dealId} · {callbackTypeLabel(event.type)}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--pc-text-secondary, #475569)', wordBreak: 'break-word' }}>{normalizeBankMoneyCopy(event.note)}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--pc-text-muted, #6B778C)' }}>{event.amountRub ? formatMoney(event.amountRub) : '—'}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', borderRadius: 999, background: b.bg, border: `1px solid ${b.border}`, color: b.color, fontSize: 11, fontWeight: 800 }}>{b.label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
