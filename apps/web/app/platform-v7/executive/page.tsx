import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { ExecutiveSignalWall, type ExecutiveSignal } from '@/components/platform-v7/ExecutiveSignalWall';
import { EmptyState } from '@/components/platform-v7/EmptyState';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, disputeTotalHeldRub, openDisputeCount } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';

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
    color: 'var(--pc-text-muted, #667085)',
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
      <header style={{ display: 'grid', gap: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em', margin: 0, color: 'var(--pc-text-primary, #0F1419)' }}>
          Исполнительная панель
        </h1>
        <p style={{ color: 'var(--pc-text-muted, #667085)', fontSize: 13, margin: 0 }}>
          Только просмотр: деньги, споры, блокеры и портфель без права действия
        </p>
      </header>

      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        pendingBankOps={pendingBank}
        openDisputes={disputeCount}
        activeShipments={shipmentCount}
      />

      <ExecutiveSignalWall signals={signals} />

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
