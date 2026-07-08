import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { PriceChart } from '@/components/platform-v7/PriceChart';
import { ExecutiveSignalWall, type ExecutiveSignal } from '@/components/platform-v7/ExecutiveSignalWall';
import { EmptyState } from '@/components/platform-v7/EmptyState';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';
import { CockpitHero, PremiumStatCard } from '@/components/platform-v7/premium';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { getPlatformV7BiCockpitState } from '@/lib/platform-v7/runtime/bi-cockpit-state';
import { UnitEconomicsPassport } from '@/components/platform-v7/UnitEconomicsPassport';
import { ClickHouseAnalyticsPanel } from '@/components/platform-v7/ClickHouseAnalyticsPanel';
import { MlPricePredictorPanel } from '@/components/platform-v7/MlPricePredictorPanel';

function formatMoney(rub: number): string {
  if (rub >= 1_000_000_000) return `${(rub / 1_000_000_000).toFixed(2)} млрд ₽`;
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function ExecutivePage() {
  const [deals, disputes, shipments, outbox] = await Promise.all([
    getDealsCanonical(),
    getDisputes(),
    getShipments(),
    getOutboxStatus(),
  ]);

  const apiOnline = outbox.isApiAvailable;
  const dealList: any[] = Array.isArray(deals) ? deals : [];
  const activeDeals = dealList.filter((d) => !['CLOSED', 'CANCELLED'].includes(d.status));
  const totalVolume = dealList.reduce((sum, d) => sum + (d.totalRub ?? 0), 0);
  const heldRub = disputeTotalHeldRub(disputes);
  const disputeCount = openDisputeCount(disputes);
  const shipmentCount = activeShipmentCount(shipments);
  const pendingBank = outbox.totalPending ?? 0;
  const bi = getPlatformV7BiCockpitState();

  const liveBlockers = [
    ...(disputeCount > 0 ? [{ id: 'disp', label: `${disputeCount} открытых спора — удержано ${formatMoney(heldRub)}`, severity: 'stop' as const }] : []),
    ...(pendingBank > 0 ? [{ id: 'outbox', label: `${pendingBank} банковских операций ожидают подтверждения`, severity: 'warn' as const }] : []),
  ];

  const mainBlocker = liveBlockers[0]?.label ?? 'блокеров нет';

  const signals: ExecutiveSignal[] = [
    {
      label: 'Деньги в блоке',
      value: formatMoney(heldRub),
      detail: disputeCount > 0 ? 'удержано до решения открытых споров' : 'удержаний по спорам нет',
      state: heldRub > 0 ? 'stop' : 'ok',
    },
    {
      label: 'Открытые споры',
      value: String(disputeCount),
      detail: disputeCount > 0 ? 'каждый спор останавливает свою часть выплаты' : 'спорных сделок нет',
      state: disputeCount > 0 ? 'stop' : 'ok',
    },
    {
      label: 'Главный блокер',
      value: liveBlockers.length > 0 ? String(liveBlockers.length) : '0',
      detail: mainBlocker,
      state: liveBlockers.some((b) => b.severity === 'stop') ? 'stop' : liveBlockers.length > 0 ? 'wait' : 'ok',
    },
    {
      label: 'Банк ожидает',
      value: String(pendingBank),
      detail: pendingBank > 0 ? 'операции ждут банковского подтверждения' : 'нет операций в ожидании банка',
      state: pendingBank > 0 ? 'wait' : 'ok',
    },
    {
      label: 'Портфель',
      value: formatMoney(totalVolume),
      detail: `${dealList.length} сделок · ${activeDeals.length} активных · ${shipmentCount} рейсов`,
      state: 'ok',
    },
  ];

  const th: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    color: 'var(--pc-text-muted, #58606E)',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
  };
  const td: React.CSSProperties = {
    padding: '10px 14px',
    color: 'var(--pc-text-secondary, #475569)',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <main style={{ display: 'grid', gap: 16, maxWidth: 1080, margin: '0 auto', padding: '12px 16px 32px' }}>
      <CockpitHero
        eyebrow='Руководитель · только просмотр'
        title='Стратегический контроль.'
        accent='Фокус на результате.'
        lead='Исполнительная панель: деньги, споры, блокеры и портфель без права действия.'
      >
        <div className='pc-prem-kpis' aria-label='Ключевые показатели руководителя'>
          <PremiumStatCard glyph='coins' tone={heldRub > 0 ? 'danger' : 'success'} value={formatMoney(heldRub)} label='Деньги в блоке' />
          <PremiumStatCard glyph='bag' tone='info' value={String(activeDeals.length)} label='Сделок под контролем' />
          <PremiumStatCard glyph='alert' tone={disputeCount > 0 ? 'danger' : 'neutral'} value={String(disputeCount)} label='Открытых споров' />
          <PremiumStatCard glyph='shield-check' tone={pendingBank > 0 ? 'warning' : 'success'} value={String(pendingBank)} label='Банк ожидает' />
        </div>
      </CockpitHero>

      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        pendingBankOps={pendingBank}
        openDisputes={disputeCount}
        activeShipments={shipmentCount}
      />

      <ExecutiveSignalWall signals={signals} />

      <CollapsibleSection title='Юнит-экономика (BI)' summary='из runtime-сделок' defaultOpen={false}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div className='pc-prem-kpis' aria-label='Юнит-экономика'>
            {bi.metrics.map((m) => (
              <PremiumStatCard
                key={m.key}
                glyph={m.key === 'gmv' ? 'coins' : m.key === 'dispute-rate' ? 'alert' : m.basis === 'scenario' ? 'gauge' : 'bag'}
                tone={m.basis === 'scenario' ? 'neutral' : 'info'}
                value={m.value}
                label={m.label}
              />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--pc-text-muted, #58606E)', lineHeight: 1.5 }}>{bi.note}</p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title='Unit Economics Passport' summary='GMV · Take Rate · LTV · CAC · 3 сценария' defaultOpen={false}>
        <UnitEconomicsPassport />
      </CollapsibleSection>

      <CollapsibleSection title='Аналитика GMV · предынтеграционный макет' summary='структура ClickHouse · сценарные данные · без промышленного SLA' defaultOpen={false}>
        <ClickHouseAnalyticsPanel />
      </CollapsibleSection>

      <CollapsibleSection title='Ценовой прогноз · сценарный ML-макет' summary='модельный экран · доверительный интервал · не торговая рекомендация' defaultOpen={false}>
        <MlPricePredictorPanel />
      </CollapsibleSection>

      <CollapsibleSection title='Динамика цен на зерно' summary='12 мес · пшеница · ячмень · кукуруза' defaultOpen={false}>
        <PriceChart cultures={['wheat_3', 'wheat_4', 'barley', 'corn', 'sunflower']} defaultPeriod={12} />
      </CollapsibleSection>

      <section
        style={{
          background: 'var(--pc-bg-card, #fff)',
          border: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--pc-border, rgba(63,56,38,0.12))',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--pc-text-primary, #0F1419)',
          }}
        >
          Сделки
        </div>
        {dealList.length === 0 ? (
          <EmptyState title='Сделок пока нет' description='Когда сделки появятся в контуре исполнения, они отобразятся здесь с суммами, статусом и блокерами.' />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--pc-bg-subtle, #F5F1E8)' }}>
                  {['ID', 'Статус', 'Культура', 'Объём, т', 'Сумма', 'Владелец'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealList.slice(0, 20).map((d, i) => (
                  <tr key={d.id} style={{ borderBottom: i < dealList.length - 1 ? '1px solid var(--pc-border, rgba(63,56,38,0.08))' : undefined }}>
                    <td style={{ ...td, fontFamily: 'var(--pc-font-mono, monospace)', color: 'var(--pc-text-primary, #0F1419)' }}>{d.id}</td>
                    <td style={td}>{d.status}</td>
                    <td style={td}>{d.culture ?? '—'}</td>
                    <td style={td}>{d.volumeTons ?? '—'}</td>
                    <td style={td}>{d.totalRub ? formatMoney(d.totalRub) : '—'}</td>
                    <td style={td}>{d.owner ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
