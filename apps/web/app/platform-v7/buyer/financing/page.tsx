'use client';

import * as React from 'react';
import Link from 'next/link';

// ─── palette ────────────────────────────────────────────────────────────────
const S = 'var(--pc-bg-card)';
const SS = 'var(--pc-bg-elevated)';
const B = 'var(--pc-border)';
const T = 'var(--pc-text-primary)';
const M = 'var(--pc-text-secondary)';
const BRAND = '#0A7A5F';
const BRAND_BG = 'rgba(10,122,95,0.08)';
const BRAND_BORDER = 'rgba(10,122,95,0.18)';
const MONEY = '#155EEF';
const MONEY_BG = 'rgba(21,94,239,0.06)';
const MONEY_BORDER = 'rgba(21,94,239,0.18)';
const WARN_BG = 'rgba(217,119,6,0.08)';
const WARN_BORDER = 'rgba(217,119,6,0.18)';
const WARN = '#B45309';

// ─── sandbox fixtures ───────────────────────────────────────────────────────

interface CreditApplication {
  id: string;
  dealId?: string;
  grain?: string;
  volumeTons?: number;
  amount: number;
  rate: number;
  termDays: number;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'disbursed' | 'rejected';
  submittedAt?: string;
}

const SANDBOX_APPLICATIONS: CreditApplication[] = [
  { id: 'cr-001', dealId: 'DL-9101', grain: 'Пшеница 4 кл.', volumeTons: 240, amount: 2_976_000, rate: 14.5, termDays: 90, status: 'approved', submittedAt: '2026-04-20' },
  { id: 'cr-002', dealId: 'DL-9103', grain: 'Кукуруза 1 кл.', volumeTons: 360, amount: 4_680_000, rate: 15.0, termDays: 60, status: 'under_review', submittedAt: '2026-04-25' },
];

const CREDIT_LIMITS = {
  total: 20_000_000,
  used: 7_656_000,
  available: 12_344_000,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function statusTone(s: CreditApplication['status']) {
  if (s === 'approved' || s === 'disbursed') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: s === 'disbursed' ? 'Выдан' : 'Одобрен' };
  if (s === 'under_review') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'На проверке' };
  if (s === 'rejected') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'Отказ' };
  if (s === 'submitted') return { bg: MONEY_BG, border: MONEY_BORDER, color: MONEY, label: 'Подан' };
  return { bg: SS, border: B, color: M, label: 'Черновик' };
}

function btn(kind: 'primary' | 'default' = 'default'): React.CSSProperties {
  if (kind === 'primary') return { textDecoration: 'none', borderRadius: 12, padding: '10px 16px', background: MONEY_BG, border: `1px solid ${MONEY_BORDER}`, color: MONEY, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-block' };
  return { textDecoration: 'none', borderRadius: 12, padding: '10px 16px', background: SS, border: `1px solid ${B}`, color: T, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-block' };
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function BuyerFinancingPage() {
  const [showForm, setShowForm] = React.useState(false);
  const [formAmount, setFormAmount] = React.useState('');
  const [formTerm, setFormTerm] = React.useState('90');
  const [formDeal, setFormDeal] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setShowForm(false);
  }

  const usedPct = Math.round((CREDIT_LIMITS.used / CREDIT_LIMITS.total) * 100);

  return (
    <div style={{ display: 'grid', gap: 18, padding: '8px 0' }}>
      {/* Header */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Покупатель · Финансирование · <span style={{ color: WARN }}>sandbox</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T, marginTop: 8, lineHeight: 1.1 }}>B2B-кредитование</div>
            <div style={{ marginTop: 8, fontSize: 14, color: M, maxWidth: 700 }}>
              Инструмент покупателя для финансирования закупок зерна. Кредит привязывается к конкретной сделке и управляется через платёжный контур.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowForm((v) => !v)} style={btn('primary')}>
              {showForm ? 'Отменить' : 'Подать заявку'}
            </button>
            <Link href='/platform-v7/buyer' style={btn()}>← Назад</Link>
          </div>
        </div>
      </section>

      {/* Sandbox notice */}
      <section style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: WARN, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Режим: sandbox</div>
        <div style={{ marginTop: 6, fontSize: 13, color: T, lineHeight: 1.5 }}>
          Данные демонстрационные. Реальных запросов к банку не выполняется. В live-режиме заявка уходит в Сбер API, проверяется лимит, и средства резервируются через Safe Deals.
          Кредитный виджет доступен только в кабинете покупателя.
        </div>
      </section>

      {/* Credit limit */}
      <section style={{ background: MONEY_BG, border: `1px solid ${MONEY_BORDER}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: MONEY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Лимит финансирования</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginTop: 14 }}>
          <MetricCell label='Общий лимит' value={fmt(CREDIT_LIMITS.total)} color={MONEY} />
          <MetricCell label='Использовано' value={fmt(CREDIT_LIMITS.used)} color={WARN} />
          <MetricCell label='Доступно' value={fmt(CREDIT_LIMITS.available)} color={BRAND} />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: M, fontWeight: 700, marginBottom: 6 }}>Использовано {usedPct}%</div>
          <div style={{ background: B, borderRadius: 99, height: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${usedPct}%`, background: MONEY, borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
      </section>

      {/* Application form */}
      {showForm && (
        <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T, marginBottom: 14 }}>Новая заявка на финансирование</div>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <FormField label='Привязать к сделке (ID)'>
              <input
                value={formDeal}
                onChange={(e) => setFormDeal(e.target.value)}
                placeholder='DL-9101'
                style={inputStyle()}
              />
            </FormField>
            <FormField label='Сумма финансирования, ₽'>
              <input
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder='1 000 000'
                type='number'
                min={100000}
                max={CREDIT_LIMITS.available}
                style={inputStyle()}
              />
            </FormField>
            <FormField label='Срок, дней'>
              <select value={formTerm} onChange={(e) => setFormTerm(e.target.value)} style={inputStyle()}>
                <option value='30'>30 дней</option>
                <option value='60'>60 дней</option>
                <option value='90'>90 дней</option>
                <option value='120'>120 дней</option>
                <option value='180'>180 дней</option>
              </select>
            </FormField>
            <div style={{ fontSize: 12, color: M }}>
              Ориентировочная ставка: 14.5–16% годовых. Финальная ставка определяется банком по результатам проверки.
            </div>
            <div>
              <button type='submit' style={btn('primary')}>Подать заявку (sandbox)</button>
            </div>
          </form>
        </section>
      )}

      {/* Submitted confirmation */}
      {submitted && (
        <section style={{ background: BRAND_BG, border: `1px solid ${BRAND_BORDER}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: BRAND }}>Заявка подана (sandbox)</div>
          <div style={{ fontSize: 13, color: T, marginTop: 6 }}>
            В production-режиме заявка ушла бы в банк на проверку. Статус появится в списке ниже через 1–2 рабочих дня.
          </div>
        </section>
      )}

      {/* Applications list */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T, marginBottom: 14 }}>Мои заявки</div>
        {SANDBOX_APPLICATIONS.length === 0 ? (
          <div style={{ fontSize: 13, color: M }}>Нет активных заявок.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {SANDBOX_APPLICATIONS.map((app) => {
              const tone = statusTone(app.status);
              return (
                <div key={app.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: MONEY }}>{app.id}</span>
                      {app.dealId && <span style={{ marginLeft: 8, fontSize: 12, color: M }}>→ {app.dealId}</span>}
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
                      {tone.label}
                    </span>
                  </div>
                  {app.grain && (
                    <div style={{ fontSize: 13, color: T, marginTop: 8, fontWeight: 700 }}>{app.grain} · {app.volumeTons} т</div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 10 }}>
                    <SmallCell label='Сумма' value={fmt(app.amount)} />
                    <SmallCell label='Ставка' value={`${app.rate}% год.`} />
                    <SmallCell label='Срок' value={`${app.termDays} дн.`} />
                    {app.submittedAt && <SmallCell label='Подана' value={app.submittedAt} />}
                  </div>
                  {app.dealId && (
                    <div style={{ marginTop: 10 }}>
                      <Link href={`/platform-v7/deals/${app.dealId}`} style={{ fontSize: 12, color: BRAND, textDecoration: 'none', fontWeight: 700 }}>
                        Открыть сделку {app.dealId} →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Factoring info */}
      <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T, marginBottom: 8 }}>Факторинг</div>
        <div style={{ fontSize: 13, color: M, lineHeight: 1.6 }}>
          Факторинг — инструмент продавца. Он позволяет получить деньги за поставку до фактического выпуска покупателем.
          В кабинете покупателя факторинг не доступен — он управляется через{' '}
          <Link href='/platform-v7/bank/factoring' style={{ color: BRAND, textDecoration: 'none', fontWeight: 700 }}>Банк → Факторинг</Link>.
        </div>
      </section>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: S, border: `1px solid ${B}`, borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function SmallCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: M, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '11px 14px',
    borderRadius: 10,
    border: `1px solid ${B}`,
    fontSize: 14,
    background: SS,
    color: T,
  };
}
