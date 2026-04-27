'use client';

import * as React from 'react';
import Link from 'next/link';

// Integration maturity: controlled-pilot — manual review queue runs in real time for operators
const MATURITY = 'controlled-pilot';

type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'escalated';
type ReviewReason =
  | 'beneficiary_change'
  | 'large_amount'
  | 'compliance_flag'
  | 'duplicate_suspected'
  | 'gate_override_requested';

interface ManualReviewItem {
  id: string;
  dealId: string;
  amount: number;
  status: ReviewStatus;
  reason: ReviewReason;
  description: string;
  requestedAt: string;
  reviewer?: string;
  blockers: string[];
}

const SANDBOX_REVIEW_QUEUE: ManualReviewItem[] = [
  {
    id: 'mr-001',
    dealId: 'DL-9103',
    amount: 4_464_000,
    status: 'pending',
    reason: 'beneficiary_change',
    description: 'Реквизиты получателя изменились менее чем за 48 часов до выплаты.',
    requestedAt: '2026-04-27T09:15:00Z',
    blockers: ['Повторный KYB не завершён', 'Compliance заморожен'],
  },
  {
    id: 'mr-002',
    dealId: 'DL-9105',
    amount: 8_100_000,
    status: 'in_review',
    reason: 'large_amount',
    description: 'Сумма выпуска превышает автоматический лимит банка (5 000 000 ₽). Требуется ручное одобрение.',
    requestedAt: '2026-04-26T16:00:00Z',
    reviewer: 'Смирнов А.К.',
    blockers: [],
  },
  {
    id: 'mr-003',
    dealId: 'DL-9101',
    amount: 2_976_000,
    status: 'approved',
    reason: 'compliance_flag',
    description: 'Автоматическая проверка по санкционным спискам вернула предупреждение. Ручная проверка прошла.',
    requestedAt: '2026-04-25T11:30:00Z',
    reviewer: 'Козлова М.В.',
    blockers: [],
  },
];

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
const INFO_BG = 'rgba(37,99,235,0.06)';
const INFO_BORDER = 'rgba(37,99,235,0.18)';
const INFO = '#2563EB';

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function statusTone(s: ReviewStatus) {
  if (s === 'approved') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Одобрено' };
  if (s === 'in_review') return { bg: INFO_BG, border: INFO_BORDER, color: INFO, label: 'На проверке' };
  if (s === 'pending') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Ожидает' };
  if (s === 'rejected') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Отклонено' };
  return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Эскалация' };
}

function reasonLabel(r: ReviewReason): string {
  const map: Record<ReviewReason, string> = {
    beneficiary_change: 'Смена реквизитов',
    large_amount: 'Крупная сумма',
    compliance_flag: 'Compliance-флаг',
    duplicate_suspected: 'Подозрение на дубль',
    gate_override_requested: 'Запрос на обход gate',
  };
  return map[r] ?? r;
}

export function BankManualReviewPanel() {
  const [approving, setApproving] = React.useState<string | null>(null);
  const pending = SANDBOX_REVIEW_QUEUE.filter((r) => r.status === 'pending' || r.status === 'in_review').length;

  function handleApprove(id: string) {
    setApproving(id);
    setTimeout(() => setApproving(null), 1500);
  }

  return (
    <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Ручная проверка · <span style={{ color: BRAND }}>{MATURITY}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T, marginTop: 4 }}>Очередь ручного одобрения</div>
          {pending > 0 && (
            <div style={{ marginTop: 4, fontSize: 13, color: WARN, fontWeight: 700 }}>
              {pending} {pending === 1 ? 'позиция требует' : 'позиции требуют'} действия
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {SANDBOX_REVIEW_QUEUE.map((item) => {
          const tone = statusTone(item.status);
          const isApproving = approving === item.id;
          const canApprove = item.status === 'pending' || item.status === 'in_review';
          const hasBlockers = item.blockers.length > 0;

          return (
            <div key={item.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: WARN }}>{item.id}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: M }}>→</span>
                  <Link href={`/platform-v7/deals/${item.dealId}`} style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: BRAND, textDecoration: 'none' }}>
                    {item.dealId}
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: SS, border: `1px solid ${B}`, color: M }}>
                    {reasonLabel(item.reason)}
                  </span>
                  <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
                    {tone.label}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: T }}>{fmt(item.amount)}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: M, lineHeight: 1.5 }}>{item.description}</div>
              {item.reviewer && (
                <div style={{ marginTop: 6, fontSize: 12, color: M }}>Проверяет: <strong>{item.reviewer}</strong></div>
              )}

              {hasBlockers && (
                <div style={{ marginTop: 10, background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: ERR, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Блокеры</div>
                  {item.blockers.map((bl, i) => (
                    <div key={i} style={{ fontSize: 12, color: ERR }}>· {bl}</div>
                  ))}
                </div>
              )}

              {canApprove && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={isApproving || hasBlockers}
                    style={{
                      borderRadius: 10,
                      padding: '8px 14px',
                      background: hasBlockers ? SS : BRAND_BG,
                      border: `1px solid ${hasBlockers ? B : BRAND_BORDER}`,
                      color: hasBlockers ? M : BRAND,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: hasBlockers ? 'not-allowed' : 'pointer',
                      opacity: isApproving ? 0.6 : 1,
                    }}
                  >
                    {isApproving ? 'Одобряется…' : hasBlockers ? 'Блокеры не сняты' : 'Одобрить (sandbox)'}
                  </button>
                  <button
                    style={{
                      borderRadius: 10,
                      padding: '8px 14px',
                      background: ERR_BG,
                      border: `1px solid ${ERR_BORDER}`,
                      color: ERR,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
