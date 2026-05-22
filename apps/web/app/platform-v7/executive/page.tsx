import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
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

  const kpis = [
    { label: 'Сделки (всего)', value: String(dealList.length), sub: `${activeDeals.length} активных` },
    { label: 'Объём', value: formatMoney(totalVolume), sub: 'сумма всех сделок' },
    { label: 'Рейсы', value: String(shipmentCount), sub: 'активных рейсов' },
    { label: 'Споры', value: String(disputeCount), sub: `${formatMoney(heldRub)} заморожено` },
    { label: 'Банк', value: String(pendingBank), sub: 'ожидают callback' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Исполнительная панель</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Read-only — только просмотр</p>

      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        pendingBankOps={pendingBank}
        openDisputes={disputeCount}
        activeShipments={shipmentCount}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 24 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 14px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
          Сделки
        </div>
        {dealList.length === 0 ? (
          <div style={{ padding: 24, color: '#9ca3af', textAlign: 'center', fontSize: 14 }}>Нет данных</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['ID', 'Статус', 'Культура', 'Объём, т', 'Сумма', 'Владелец'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 500, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dealList.slice(0, 20).map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < dealList.length - 1 ? '1px solid #f3f4f6' : undefined }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#374151' }}>{d.id}</td>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>{d.status}</td>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>{d.culture ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>{d.volumeTons ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>{d.totalRub ? formatMoney(d.totalRub) : '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#374151' }}>{d.owner ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
