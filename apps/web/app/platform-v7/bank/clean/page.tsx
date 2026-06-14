import Link from 'next/link';
import type { CSSProperties } from 'react';
import { MoneyGateRing } from '@/components/v7r/MoneyGateRing';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import { getPlatformV7BankCockpitState } from '@/lib/platform-v7/runtime/bank-cockpit-state';
import { getPlatformV7DisputeCockpitState } from '@/lib/platform-v7/runtime/dispute-cockpit-state';

const micro: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--pc-text-muted, #58606E)',
};

const card: CSSProperties = {
  background: 'var(--pc-bg-card, #fff)',
  border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  borderRadius: 16,
  padding: '18px 20px',
  display: 'grid',
  gap: 12,
};

const th: CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  color: 'var(--pc-text-muted, #58606E)',
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  padding: '10px 14px',
  color: 'var(--pc-text-secondary, #475569)',
  fontSize: 13,
  verticalAlign: 'top',
};

export default function BankCleanPage() {
  const deal = getDeal360Scenario('DL-9106');
  const disputed = getDeal360Scenario('DL-9102');
  const blockingDocs = deal.documents.filter((doc) => doc.blocksMoney);
  // VP-6/VP-7: суммы и основание читаются из runtime-слоя Stage 5.
  const bank = getPlatformV7BankCockpitState();
  const disputeState = getPlatformV7DisputeCockpitState();

  return (
    <main style={{ display: 'grid', gap: 16, maxWidth: 1080, margin: '0 auto', padding: '12px 0 32px' }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--pc-text-primary, #0F1419)' }}>
          Деньги по сделкам
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--pc-text-muted, #58606E)' }}>
          Банк видит основание выплаты и статусы; решение о движении денег принимает банк по своим правилам. Платформа деньги не выпускает.
        </p>
      </header>

      <MoneyGateRing
        title={`Деньги по сделке ${bank.dealId}`}
        totalRub={9_648_000}
        segments={[
          { label: 'Банк подтвердил выплату', amountRub: bank.releasedRub, state: 'released' },
          { label: 'Резерв заявлен покупателем', amountRub: bank.reservedRub, state: 'reserved' },
        ]}
        caption='Основание выплаты не передано: документные условия не закрыты. Банковское подтверждение резерва ожидается.'
      />

      <section aria-label='Основание выплаты' style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={micro}>Основание выплаты · {deal.dealId}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pc-danger, #B42318)' }}>
            {blockingDocs.length} из {deal.documents.length} документов блокируют выплату
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--pc-bg-subtle, #F5F1E8)' }}>
                <th style={th}>Документ</th>
                <th style={th}>Источник</th>
                <th style={th}>Ответственный</th>
                <th style={th}>Статус</th>
                <th style={th}>Влияние на деньги</th>
              </tr>
            </thead>
            <tbody>
              {deal.documents.map((doc) => (
                <tr key={doc.title} style={{ borderBottom: '1px solid var(--pc-border, rgba(63,56,38,0.08))' }}>
                  <td style={{ ...td, fontWeight: 700, color: 'var(--pc-text-primary, #0F1419)' }}>{doc.title}</td>
                  <td style={td}>{doc.source}</td>
                  <td style={td}>{doc.responsible}</td>
                  <td style={td}>{doc.status}</td>
                  <td style={{ ...td, fontWeight: 700, color: doc.blocksMoney ? 'var(--pc-danger, #B42318)' : 'var(--pc-success, #027A48)' }}>
                    {doc.blocksMoney ? 'блокирует выплату' : 'не блокирует'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label='Спорная сделка' style={card}>
        <span style={micro}>Удержание по спору · {disputed.dealId}</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {disputed.money.map((row) => (
            <div key={row.title} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #58606E)' }}>{row.title}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                  color: row.state === 'stop' ? 'var(--pc-danger, #B42318)' : 'var(--pc-text-primary, #0F1419)',
                }}
              >
                {row.value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--pc-text-secondary, #475569)', lineHeight: 1.45 }}>{row.note}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--pc-text-secondary, #475569)' }}>
          {disputed.cockpit.cannotHappenReason}
        </div>
      </section>

      <section aria-label='Ручная проверка' style={card}>
        <span style={micro}>Ручная проверка</span>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--pc-text-secondary, #475569)' }}>
          Спорные и нестандартные основания уходят на ручную проверку банковского операциониста. Платформа фиксирует передачу основания и ждёт банковское событие; статус всегда дублируется текстом в журнале сделки.
        </p>
        <div style={{ fontSize: 12, color: 'var(--pc-text-muted, #58606E)', lineHeight: 1.5 }}>
          Контур исполнения (runtime): {bank.basisLabel}; удержание по спору {disputeState.heldLabel}.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/bank/release-safety' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 700, fontSize: 13 }}>
            Проверка выплаты
          </Link>
          <Link href='/platform-v7/bank/payment-basis' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 700, fontSize: 13 }}>
            Основание платежа
          </Link>
          <Link href='/platform-v7/bank/events' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 700, fontSize: 13 }}>
            События банка
          </Link>
          <Link href='/platform-v7/control-tower' style={{ color: 'var(--pc-accent, #0A7A5F)', fontWeight: 700, fontSize: 13 }}>
            Центр управления
          </Link>
        </div>
      </section>
    </main>
  );
}
