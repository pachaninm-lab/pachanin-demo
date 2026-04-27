'use client';

import Link from 'next/link';

const MATURITY = 'sandbox';

type BeneficiaryStatus = 'verified' | 'pending_kyb' | 'frozen';

interface Beneficiary {
  id: string;
  dealId: string;
  orgName: string;
  role: 'seller' | 'buyer' | 'carrier';
  accountAlias: string;
  bankName: string;
  status: BeneficiaryStatus;
  frozenReason?: string;
  payoutAmount: number;
}

const BENEFICIARIES: Beneficiary[] = [
  { id: 'ben-001', dealId: 'DL-9101', orgName: 'Sandbox Seller A', role: 'seller', accountAlias: 'ACC-001', bankName: 'Sandbox Bank A', status: 'verified', payoutAmount: 2_976_000 },
  { id: 'ben-002', dealId: 'DL-9102', orgName: 'Sandbox Seller B', role: 'seller', accountAlias: 'ACC-002', bankName: 'Sandbox Bank A', status: 'pending_kyb', payoutAmount: 2_160_000 },
  { id: 'ben-003', dealId: 'DL-9103', orgName: 'Sandbox Seller C', role: 'seller', accountAlias: 'ACC-003', bankName: 'Sandbox Bank B', status: 'frozen', frozenReason: 'Sandbox beneficiary change requires repeat review.', payoutAmount: 4_464_000 },
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

function statusTone(status: BeneficiaryStatus) {
  if (status === 'verified') return { bg: BRAND_BG, border: BRAND_BORDER, color: BRAND, label: 'Проверен' };
  if (status === 'pending_kyb') return { bg: WARN_BG, border: WARN_BORDER, color: WARN, label: 'Проверка' };
  return { bg: ERR_BG, border: ERR_BORDER, color: ERR, label: 'Заморожен' };
}

export function BankBeneficiariesPanel() {
  const frozen = BENEFICIARIES.filter((item) => item.status === 'frozen');
  const frozenAmount = frozen.reduce((sum, item) => sum + item.payoutAmount, 0);

  return (
    <section style={{ background: S, border: `1px solid ${B}`, borderRadius: 18, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: M, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Получатели выплат · <span style={{ color: WARN }}>{MATURITY}</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T, marginTop: 4 }}>Бенефициары</div>
        {frozen.length > 0 ? <div style={{ marginTop: 4, fontSize: 13, color: ERR, fontWeight: 700 }}>{frozen.length} заморожено · {fmt(frozenAmount)}</div> : null}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {BENEFICIARIES.map((item) => {
          const tone = statusTone(item.status);
          return (
            <div key={item.id} style={{ background: SS, border: `1px solid ${B}`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 14, color: T }}>{item.orgName}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: M, border: `1px solid ${B}`, borderRadius: 6, padding: '2px 6px' }}>{item.role}</span>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color }}>{tone.label}</span>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
                <Cell label='К выплате' value={fmt(item.payoutAmount)} danger={item.status === 'frozen'} />
                <Cell label='Счёт' value={item.accountAlias} />
                <Cell label='Банк' value={item.bankName} />
                <Cell label='Сделка'><Link href={`/platform-v7/deals/${item.dealId}`} style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: BRAND, textDecoration: 'none' }}>{item.dealId}</Link></Cell>
              </div>
              {item.frozenReason ? <div style={{ marginTop: 10, background: ERR_BG, border: `1px solid ${ERR_BORDER}`, borderRadius: 8, padding: 10, fontSize: 12, color: ERR }}>⚠ {item.frozenReason}</div> : null}
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
      <div style={{ fontSize: 13, fontWeight: 700, color: danger ? ERR : T, marginTop: 4 }}>{children ?? value}</div>
    </div>
  );
}
