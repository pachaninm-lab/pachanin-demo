'use client';

import * as React from 'react';
import Link from 'next/link';

// Integration maturity: sandbox
const MATURITY = 'sandbox';

type BeneficiaryStatus = 'verified' | 'pending_kyb' | 'frozen' | 'blocked';

interface Beneficiary {
  id: string;
  dealId: string;
  orgName: string;
  inn: string;
  role: 'seller' | 'buyer' | 'carrier';
  bankAccount: string;
  bankName: string;
  status: BeneficiaryStatus;
  frozenReason?: string;
  payoutAmount: number;
  verifiedAt?: string;
}

const SANDBOX_BENEFICIARIES: Beneficiary[] = [
  { id: 'ben-001', dealId: 'DL-9101', orgName: 'Агро-Юг ООО', inn: '6829123456', role: 'seller', bankAccount: '40702810400000012345', bankName: 'Сбербанк', status: 'verified', payoutAmount: 2_976_000, verifiedAt: '2026-04-20' },
  { id: 'ben-002', dealId: 'DL-9102', orgName: 'КФХ Мирный', inn: '3664098765', role: 'seller', bankAccount: '40802810500000067890', bankName: 'Сбербанк', status: 'pending_kyb', payoutAmount: 2_160_000 },
  { id: 'ben-003', dealId: 'DL-9103', orgName: 'АО СолнцеАгро', inn: '7701234567', role: 'seller', bankAccount: '40702810600000034567', bankName: 'ВТБ', status: 'frozen', frozenReason: 'Реквизиты изменились перед выплатой. Требуется повторный KYB.', payoutAmount: 4_464_000 },
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

function fmt(n: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function statusTone(s: BeneficiaryStatus) {
  if (s === 'verified') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Верифицирован' };
  if (s === 'pending_kyb') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'KYB на проверке' };
  if (s === 'frozen') return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Заморожен' };
  return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Заблокирован' };
}

export function BankBeneficiariesPanel() {
  const frozen = SANDBOX_BENEFICIARIES.filter((b) => b.status === 'frozen').length;
  const frozenAmount = SANDBOX_BENEFICIARIES.filter((b) => b.status === 'frozen').reduce((s, b) => s + b.payoutAmount, 0);

  return (
    <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Бенефициары · <span style={{ color: WARN }}>{MATURITY}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T, marginTop: 4 }}>Получатели выплат</div>
          {frozen > 0 && (
            <div style={{ marginTop: 4, fontSize: 13, color: ERR, fontWeight: 700 }}>
              {frozen} заморожено · {fmt(frozenAmount)} заблокировано
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {SANDBOX_BENEFICIARIES.map((ben) => {
          const tone = statusTone(ben.status);
          return (
            <div key={ben.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: T }}>{ben.orgName}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: M }}>ИНН {ben.inn}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: M, background: SS, border: `1px solid ${B}`, borderRadius: 6, padding: '2px 6px' }}>
                    {ben.role === 'seller' ? 'Продавец' : ben.role === 'buyer' ? 'Покупатель' : 'Перевозчик'}
                  </span>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>
                  {tone.label}
                </span>
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
                <Cell label='К выплате' value={fmt(ben.payoutAmount)} danger={ben.status === 'frozen'} />
                <Cell label='Счёт' value={`…${ben.bankAccount.slice(-6)}`} />
                <Cell label='Банк' value={ben.bankName} />
                <Cell label='Сделка'>
                  <Link href={`/platform-v7/deals/${ben.dealId}`} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: BRAND, textDecoration: 'none' }}>
                    {ben.dealId}
                  </Link>
                </Cell>
              </div>

              {ben.status === 'frozen' && ben.frozenReason && (
                <div style={{ marginTop: 10, background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 8, padding: 10, fontSize: 12, color: ERR }}>
                  ⚠ {ben.frozenReason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Cell({ label, value, danger = false, children }: { label: string; value?: string; danger?: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: M, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: danger ? ERR : T, marginTop: 4 }}>
        {children ?? value}
      </div>
    </div>
  );
}
