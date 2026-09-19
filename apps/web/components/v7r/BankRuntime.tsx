'use client';

import Link from 'next/link';
import { CALLBACKS, DEALS, getDealIntegrationState } from '@/lib/v7r/data';
import { formatCompactMoney, statusLabel } from '@/lib/v7r/helpers';
import { getTransportHotlist } from '@/lib/v7r/transport-docs';

function normalizeBankMoneyCopy(text: string): string {
  return text
    .replace(/выпуск\s+денег/gi, 'банковское подтверждение')
    .replace(/К\s+выпуску/gi, 'К банковскому шагу')
    .replace(/финальный\s+выпуск/gi, 'финальное банковское подтверждение')
    .replace(/зелёный\s+сценарий\s+выпуска/gi, 'зелёный сценарий банковской проверки')
    .replace(/выпуск/gi, 'банковский шаг')
    .replace(/release/gi, 'подтверждение')
    .replace(/платёжный\s+контур/gi, 'контур банковской проверки');
}

function badge(tone: 'ok' | 'warn' | 'block', label: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    ok: { bg: 'rgba(10,122,95,0.08)', color: '#0A7A5F' },
    warn: { bg: 'rgba(217,119,6,0.08)', color: '#B45309' },
    block: { bg: 'rgba(220,38,38,0.08)', color: '#B91C1C' },
  };
  const c = colors[tone] ?? colors.warn;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: c.bg, border: `1px solid ${c.color}22`, color: c.color, fontSize: 11, fontWeight: 800 }}>
      {label}
    </span>
  );
}

function card(title: string, value: string, note: string) {
  return (
    <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--pc-text-muted, #6B778C)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)', marginTop: 8, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.6, marginTop: 8, wordBreak: 'break-word' }}>{note}</div>
    </section>
  );
}

export function BankRuntime() {
  const totalReserved = DEALS.reduce((sum, item) => sum + item.reservedAmount, 0);
  const totalHold = DEALS.reduce((sum, item) => sum + item.holdAmount, 0);
  const reviewSum = DEALS.reduce((sum, item) => sum + Math.max(item.reservedAmount - item.holdAmount, 0), 0);
  const callbacksToReview = CALLBACKS.filter((item) => item.status !== 'ok').length;
  const transportHotlist = getTransportHotlist().slice(0, 3);

  const rows = DEALS.map((deal) => {
    const integration = getDealIntegrationState(deal.id, deal.lotId);
    const moneyImpactLabel = formatCompactMoney(deal.reservedAmount);
    const transportReleaseStateLabel = integration.nextOwner ?? '—';
    const row = {
      id: deal.id,
      buyer: deal.buyer.name,
      seller: deal.seller.name,
      status: statusLabel(deal.status),
      nextOwner: transportReleaseStateLabel,
      nextStep: integration.nextStep ?? 'Нужно уточнение оператором',
      moneyLabel: moneyImpactLabel,
    };
    return {
      ...row,
      nextStep: normalizeBankMoneyCopy(row.nextStep),
      moneyLabel: normalizeBankMoneyCopy(moneyImpactLabel),
      nextOwner: normalizeBankMoneyCopy(transportReleaseStateLabel),
    };
  });

  const events = CALLBACKS.slice(0, 4).map((event) => ({
    id: event.id,
    label: event.provider ?? event.id,
    note: event.note ? normalizeBankMoneyCopy(event.note) : normalizeBankMoneyCopy(event.status ?? ''),
    status: event.status,
  }));

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0', maxWidth: '100%', overflowX: 'hidden' }}>
      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Контур банковской проверки</div>
        <div style={{ fontSize: 13, color: 'var(--pc-text-muted, #6B778C)', lineHeight: 1.7, marginTop: 8, maxWidth: 920 }}>
          внешнее банковское подтверждение выполняет банк — платформа только передаёт основание и фиксирует статус.
          банковское подтверждение нельзя считать безопасным без закрытия всей матрицы проверки.
          финальное банковское подтверждение нельзя считать безопасным до получения внешнего события от банка.
          зелёный сценарий банковской проверки требует полного закрытия всех блокеров и документной матрицы.
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {card('В резерве', formatCompactMoney(totalReserved), 'Сумма в контуре проверки.')}
        {card('Под удержанием', formatCompactMoney(totalHold), 'Часть, требующая разбора.')}
        {card('К банковскому шагу', formatCompactMoney(reviewSum), 'Основание после закрытия блокеров.')}
        {card('События', String(callbacksToReview), 'Требуют внимания оператора.')}
      </div>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Очередь банковской проверки основания</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <div key={row.id} style={{ border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{row.id}</div>
                  <div style={{ marginTop: 4, fontSize: 13, color: 'var(--pc-text-secondary, #475569)' }}>{row.seller} → {row.buyer}</div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-secondary, #334155)', fontSize: 11, fontWeight: 800 }}>{row.status}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}>Следующий владелец: {row.nextOwner}<br />Следующий шаг: {row.nextStep}<br />Резерв: {row.moneyLabel}</div>
              <Link href={`/platform-v7/deals/${row.id}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 700, width: 'fit-content' }}>Открыть сделку</Link>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>Транспортные документы</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {transportHotlist.map((item) => (
            <div key={item.id} style={{ background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.providerLabel}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{item.title}</div>
              <div style={{ fontSize: 13, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.6 }}>{item.note}</div>
              <Link href={item.primaryHref} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', color: 'var(--pc-text-primary, #0F1419)', fontSize: 12, fontWeight: 700, width: 'fit-content' }}>Открыть пакет</Link>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid var(--pc-border, #E4E6EA)', borderRadius: 18, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>События банковской проверки</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {events.map((event) => (
            <div key={event.id} style={{ padding: 12, borderRadius: 12, background: '#F8FAFB', border: '1px solid var(--pc-border, #E4E6EA)', display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pc-text-primary, #0F1419)' }}>{event.label}</div>
                <div style={{ fontSize: 12, color: 'var(--pc-text-secondary, #475569)', marginTop: 4 }}>{event.note}</div>
              </div>
              {badge(event.status === 'ok' ? 'ok' : 'warn', event.status)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
