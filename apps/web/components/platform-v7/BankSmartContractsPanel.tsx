'use client';

import * as React from 'react';
import Link from 'next/link';

// Integration maturity: sandbox — no live Sber Smart Contracts API
const MATURITY = 'sandbox';

type SmartContractStatus = 'draft' | 'active' | 'condition_met' | 'released' | 'disputed' | 'expired';

interface ReleaseCondition {
  id: string;
  description: string;
  met: boolean;
  metAt?: string;
}

interface SmartContract {
  id: string;
  dealId: string;
  amount: number;
  currency: 'RUB';
  status: SmartContractStatus;
  conditions: ReleaseCondition[];
  createdAt: string;
  provider: 'sber_safe_deals' | 'manual';
}

const SANDBOX_CONTRACTS: SmartContract[] = [
  {
    id: 'sc-9101',
    dealId: 'DL-9101',
    amount: 2_976_000,
    currency: 'RUB',
    status: 'active',
    provider: 'sber_safe_deals',
    createdAt: '2026-04-18',
    conditions: [
      { id: 'c1', description: 'Деньги зарезервированы', met: true, metAt: '2026-04-18' },
      { id: 'c2', description: 'ЭТрН подписана всеми сторонами', met: false },
      { id: 'c3', description: 'Акт приёмки подписан', met: false },
      { id: 'c4', description: 'Споров нет', met: true, metAt: '2026-04-18' },
    ],
  },
  {
    id: 'sc-9102',
    dealId: 'DL-9102',
    amount: 2_160_000,
    currency: 'RUB',
    status: 'condition_met',
    provider: 'sber_safe_deals',
    createdAt: '2026-04-15',
    conditions: [
      { id: 'c1', description: 'Деньги зарезервированы', met: true, metAt: '2026-04-15' },
      { id: 'c2', description: 'ЭТрН подписана всеми сторонами', met: true, metAt: '2026-04-22' },
      { id: 'c3', description: 'Акт приёмки подписан', met: true, metAt: '2026-04-23' },
      { id: 'c4', description: 'Споров нет', met: true, metAt: '2026-04-23' },
    ],
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
const MONEY = '#155EEF';
const MONEY_BG = 'rgba(21,94,239,0.06)';
const MONEY_BORDER = 'rgba(21,94,239,0.18)';

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function statusTone(s: SmartContractStatus) {
  if (s === 'released') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Деньги выпущены' };
  if (s === 'condition_met') return { bg: MONEY_BG, border: MONEY_BORDER, color: MONEY, label: 'Условия выполнены' };
  if (s === 'active') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Активен' };
  if (s === 'disputed') return { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)', color: '#B91C1C', label: 'Спор' };
  if (s === 'draft') return { bg: SS, border: B, color: M, label: 'Черновик' };
  return { bg: SS, border: B, color: M, label: s };
}

export function BankSmartContractsPanel() {
  const readyToRelease = SANDBOX_CONTRACTS.filter((c) => c.status === 'condition_met').length;

  return (
    <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Смарт-контракты · <span style={{ color: WARN }}>{MATURITY}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T, marginTop: 4 }}>Условия выпуска денег</div>
          {readyToRelease > 0 && (
            <div style={{ marginTop: 4, fontSize: 13, color: MONEY, fontWeight: 700 }}>
              {readyToRelease} готово к выпуску — все условия выполнены
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 12, background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 10, padding: 10, fontSize: 12, color: WARN }}>
        Интеграция: sandbox. Реальных вызовов к Сбер Safe Deals не выполняется. Условия выпуска — демо-данные.
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {SANDBOX_CONTRACTS.map((contract) => {
          const tone = statusTone(contract.status);
          const metCount = contract.conditions.filter((c) => c.met).length;
          const totalCount = contract.conditions.length;
          const pct = Math.round((metCount / totalCount) * 100);
          return (
            <div key={contract.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: MONEY }}>{contract.id}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: M }}>→</span>
                  <Link href={`/platform-v7/deals/${contract.dealId}`} style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: BRAND, textDecoration: 'none' }}>
                    {contract.dealId}
                  </Link>
                  <span style={{ marginLeft: 8, fontSize: 12, color: M }}>· {contract.provider === 'sber_safe_deals' ? 'Сбер Safe Deals' : 'Ручной'}</span>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
                  {tone.label}
                </span>
              </div>

              <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900, color: MONEY }}>
                {fmt(contract.amount)}
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: M, fontWeight: 700, marginBottom: 5 }}>
                  Условий выполнено: {metCount}/{totalCount} ({pct}%)
                </div>
                <div style={{ background: B, borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? BRAND : MONEY, borderRadius: 99, transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Conditions list */}
              <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                {contract.conditions.map((cond) => (
                  <div key={cond.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: cond.met ? BRAND : M, fontWeight: 700, width: 16, flexShrink: 0 }}>
                      {cond.met ? '✓' : '○'}
                    </span>
                    <span style={{ color: cond.met ? T : M }}>{cond.description}</span>
                    {cond.metAt && <span style={{ color: M, marginLeft: 4, fontSize: 11 }}>{cond.metAt}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
