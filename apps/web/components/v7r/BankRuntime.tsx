'use client';

import Link from 'next/link';
import { SberKorusBadge } from '@/components/v7r/SberKorusBadge';
import { CALLBACKS, DEALS } from '@/lib/v7r/data';
import { formatCompactMoney, formatMoney } from '@/lib/v7r/helpers';
import { countTransportAwaitingSignatures, countTransportBlockedPacks, countTransportCompleted, getTransportHotlist, getTransportPackByDealId, getTransportSimulationScenario, moneyImpactLabel, transportPackStatusLabel, transportReleaseStateLabel } from '@/lib/v7r/transport-docs';

function badge(status: 'ok' | 'pending' | 'mismatch') {
  if (status === 'ok') return { bg: 'rgba(10,122,95,0.08)', border: 'rgba(10,122,95,0.18)', color: '#0A7A5F', label: 'ОК' };
  if (status === 'pending') return { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.18)', color: '#B45309', label: 'Ожидание' };
  return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'Расхождение' };
}

function callbackTypeLabel(type: string) {
  if (type === 'Reserve') return 'Резерв';
  if (type === 'Mismatch') return 'Расхождение';
  if (type === 'Release') return 'Выпуск';
  return type;
}

function SberDemoLogo() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: '#fff', border: '1px solid rgba(33,160,56,0.18)' }}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-label="Сбер" role="img">
        <defs>
          <linearGradient id="sberDemoGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#21A038" />
            <stop offset="100%" stopColor="#00B8F0" />
          </linearGradient>
        </defs>
        <circle cx="17" cy="17" r="14" fill="none" stroke="url(#sberDemoGradient)" strokeWidth="3" />
        <path d="M12 17.5l3 3 7-8" fill="none" stroke="#21A038" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'grid', gap: 2 }}>
        <div style={{ fontSize: 18, lineHeight: 1, fontWeight: 800, color: '#1F2937' }}>Сбер</div>
        <div style={{ fontSize: 11, color: '#6B778C' }}>Демо-режим банкового контура</div>
      </div>
    </div>
  );
}

function brandPill(kind: 'sberApi' | 'sberBusinessId') {
  const token = kind === 'sberApi'
    ? { label: 'Сбер API', note: 'Платёжный контур', accent: '#21A038', text: '#166534' }
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
    <section style={{ background: '#fff', border: `1px solid ${danger ? '#FECACA' : '#E4E6EA'}`, borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: danger ? '#991B1B' : '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: danger ? '#991B1B' : '#0F1419', marginTop: 8, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6B778C', lineHeight: 1.6, marginTop: 8, wordBreak: 'break-word' }}>{note}</div>
    </section>
  );
}

export function BankRuntime() {
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const totalRelease = DEALS.reduce((sum, item) => sum + (item.releaseAmount ?? Math.max(item.reservedAmount - item.holdAmount, 0)), 0);
  const mismatchCount = CALLBACKS.filter((item) => item.status === 'mismatch').length;
  const pendingCount = CALLBACKS.filter((item) => item.status === 'pending').length;
  const releaseDeal = DEALS.find((item) => item.id === 'DL-9109');
  const transportBlocked = countTransportBlockedPacks();
  const transportAwaiting = countTransportAwaitingSignatures();
  const transportCompleted = countTransportCompleted();
  const transportHotlist = getTransportHotlist().slice(0, 3);
  const transportReleaseDealPack = getTransportPackByDealId('DL-9109');
  const transportReleaseScenario = getTransportSimulationScenario('DL-9109');
  const transportCurrentStep = transportReleaseScenario?.steps[transportReleaseScenario.currentStepIndex];

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0', maxWidth: '100%', overflowX: 'hidden' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: '#0F1419', wordBreak: 'break-word' }}>Банковый контур</div>
              <SberDemoLogo />
            </div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.7, marginTop: 8, maxWidth: 920, wordBreak: 'break-word' }}>Здесь живут резерв, удержание, выпуск денег и ручные проверки банка. Банковый слой не должен теряться между сделкой, спором и документами.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {brandPill('sberBusinessId')}
            {brandPill('sberApi')}
            <div data-demo="true" style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>Демо-данные</div>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Card title='В резерве' value={formatCompactMoney(totalReserved)} note='Деньги подтверждены и заведены в контур.' />
        <Card title='Под удержанием' value={formatCompactMoney(totalHold)} note='Споры, документы и ручные проверки.' danger={totalHold > 0} />
        <Card title='К выпуску' value={formatCompactMoney(totalRelease)} note='Сумма, которая может уйти после закрытия блокеров.' />
        <Card title='Требуют внимания' value={String(mismatchCount + pendingCount)} note='События банка, которые ещё не доведены до конца.' danger={mismatchCount + pendingCount > 0} />
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Transport gate через СберКорус</div>
            <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>Банк видит транспортный документный контур как отдельный стоп-фактор. Пока пакет не закрыт у СберКорус, финальный выпуск нельзя считать безопасным.</div>
          </div>
          <SberKorusBadge subtitle='Транспортные документы и подписи' compact />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Card title='Красный stop' value={String(transportBlocked)} note='Пакеты, которые прямо блокируют финальный выпуск.' danger={transportBlocked > 0} />
          <Card title='Ждём подписи' value={String(transportAwaiting)} note='Рейсы, где контур СберКорус ещё не закрыт.' danger={transportAwaiting > 0} />
          <Card title='Зелёный контур' value={String(transportCompleted)} note='Пакеты, которые больше не спорят с выпуском денег.' />
        </div>

        {transportReleaseDealPack && transportCurrentStep ? (
          <section style={{ background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0A7A5F' }}>{transportReleaseDealPack.providerPackId}</div>
                <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: '#0F1419' }}>DL-9109 · зелёный сценарий выпуска</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#fff', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>{transportPackStatusLabel(transportReleaseDealPack.status)} · {moneyImpactLabel(transportReleaseDealPack.moneyImpactStatus)}</span>
            </div>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.65 }}><strong style={{ color: '#0F1419' }}>{transportCurrentStep.label}.</strong> {transportCurrentStep.detail}</div>
            <div style={{ fontSize: 12, color: '#0A7A5F', fontWeight: 800 }}>{transportReleaseStateLabel(transportCurrentStep.releaseState)} · {transportCurrentStep.releaseReason}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href='/platform-v7/deals/DL-9109/transport-documents' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700 }}>Открыть пакет СберКорус</Link>
              <Link href='/platform-v7/deals/DL-9109/transport-documents/simulation' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>Открыть симуляцию</Link>
            </div>
          </section>
        ) : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {transportHotlist.map((item) => (
            <div key={item.id} style={{ background: '#F8FAFB', border: '1px solid #E4E6EA', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F1419' }}>{item.title}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6B778C' }}>{item.providerLabel}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: item.moneyImpactStatus === 'blocks_release' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${item.moneyImpactStatus === 'blocks_release' ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)'}`, color: item.moneyImpactStatus === 'blocks_release' ? '#B91C1C' : '#B45309', fontSize: 11, fontWeight: 800 }}>{moneyImpactLabel(item.moneyImpactStatus)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>{item.note}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link href={item.primaryHref} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 12, fontWeight: 700 }}>Пакет</Link>
                <Link href={item.simulationHref} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E4E6EA', color: '#0F1419', fontSize: 12, fontWeight: 700 }}>Симуляция</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {releaseDeal ? (
        <section style={{ background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0A7A5F' }}>Горячая точка</div>
            {brandPill('sberApi')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', marginTop: 6, wordBreak: 'break-word' }}>DL-9109 → запрос выпуска на 10.5 млн ₽</div>
          <div style={{ fontSize: 13, color: '#334155', marginTop: 8, wordBreak: 'break-word' }}>Этот выпуск должен быть виден банку и оператору как приоритетный кейс, а не теряться внутри списка модулей.</div>
          <div style={{ marginTop: 12 }}>
            <Link href='/platform-v7/deals/DL-9109' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: '10px 14px', background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 700 }}>Открыть DL-9109</Link>
          </div>
        </section>
      ) : null}

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Реестр банковых событий</div>
            <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4 }}>Каждое событие должно вести к сделке, сумме и понятному действию.</div>
          </div>
          {brandPill('sberApi')}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {CALLBACKS.map((item) => {
            const p = badge(item.status);
            return (
              <Link key={item.id} href={`/platform-v7/deals/${item.dealId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 16, padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 13, wordBreak: 'break-word' }}>{item.id} · {callbackTypeLabel(item.type)}</div>
                      <div style={{ fontSize: 12, color: '#6B778C', marginTop: 4, wordBreak: 'break-word' }}>{item.note}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{item.amountRub ? formatMoney(item.amountRub) : '—'}</div>
                    <div><span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, color: p.color, fontSize: 11, fontWeight: 800 }}>{p.label}</span></div>
                    <div style={{ color: '#0A7A5F', fontWeight: 700, wordBreak: 'break-word' }}>{item.dealId}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
