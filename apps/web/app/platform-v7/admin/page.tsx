import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getDealsCanonical } from '@/lib/deals-server';
import { getDisputes, openDisputeCount, disputeTotalHeldRub } from '@/lib/disputes-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { getOutboxStatus } from '@/lib/outbox-server';
import { getLabSamples, pendingProtocols } from '@/lib/labs-server';

function formatMoney(rub: number): string {
  if (rub >= 1_000_000) return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  if (rub >= 1_000) return `${(rub / 1_000).toFixed(0)} тыс. ₽`;
  return `${rub} ₽`;
}

export default async function AdminPage() {
  const [deals, disputes, shipments, outbox, samples] = await Promise.all([
    getDealsCanonical(),
    getDisputes(),
    getShipments(),
    getOutboxStatus(),
    getLabSamples(),
  ]);

  const apiOnline = outbox.isApiAvailable;
  const dealList: any[] = Array.isArray(deals) ? deals : [];
  const disputeCount = openDisputeCount(disputes);
  const heldRub = disputeTotalHeldRub(disputes);
  const shipmentCount = activeShipmentCount(shipments);
  const pendingBank = outbox.totalPending ?? 0;
  const pendingLab = pendingProtocols(samples).length;
  const manualReview = outbox.manualReview?.length ?? 0;

  const liveBlockers = [
    ...(manualReview > 0 ? [{ id: 'manual', label: `${manualReview} outbox-записей требуют ручного разбора`, severity: 'stop' as const }] : []),
    ...(disputeCount > 0 ? [{ id: 'disp', label: `${disputeCount} споров — ${formatMoney(heldRub)} заморожено`, severity: 'warn' as const }] : []),
  ];

  const systemHealth = [
    { name: 'API', status: apiOnline ? 'OK' : 'DEGRADED', detail: apiOnline ? 'отвечает' : 'не отвечает — static fallback' },
    { name: 'Deals', status: 'OK', detail: `${dealList.length} сделок` },
    { name: 'Shipments', status: 'OK', detail: `${shipmentCount} активных рейсов` },
    { name: 'Disputes', status: disputeCount > 0 ? 'WARN' : 'OK', detail: `${disputeCount} открытых` },
    { name: 'Outbox (Bank)', status: pendingBank > 0 ? 'WARN' : 'OK', detail: `${pendingBank} pending, ${manualReview} manual_review` },
    { name: 'Lab', status: pendingLab > 0 ? 'WARN' : 'OK', detail: `${pendingLab} протоколов ожидают` },
  ];

  const statusColor: Record<string, string> = {
    OK: '#16a34a',
    WARN: '#d97706',
    DEGRADED: '#dc2626',
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Административная панель</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Системный статус и управление</p>

      <LiveApiStatusBar
        apiOnline={apiOnline}
        blockers={liveBlockers}
        pendingBankOps={pendingBank}
        openDisputes={disputeCount}
        activeShipments={shipmentCount}
      />

      <div style={{ marginTop: 24, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Статус системы</div>
        {systemHealth.map((item) => (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[item.status] ?? '#6b7280', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 13, width: 120, flexShrink: 0 }}>{item.name}</span>
            <span style={{ fontSize: 12, color: statusColor[item.status], fontWeight: 500, width: 80 }}>{item.status}</span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{item.detail}</span>
          </div>
        ))}
      </div>

      {manualReview > 0 && (
        <div style={{ marginTop: 20, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: 4, fontSize: 14 }}>Требуется ручной разбор</div>
          <div style={{ fontSize: 13, color: '#7f1d1d' }}>
            {manualReview} outbox-записей перешли в MANUAL_REVIEW — банк не подтвердил операцию.
            Свяжитесь с банком и обновите статус вручную через POST /settlement-engine/bank-callback.
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 14 }}>
          Быстрые ссылки
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, background: '#e5e7eb' }}>
          {[
            { label: 'Audit Log', href: '/platform-v7/audit-log' },
            { label: 'Disputes', href: '/platform-v7/disputes' },
            { label: 'Outbox / Bank', href: '/platform-v7/bank' },
            { label: 'Evidence Pack', href: '/platform-v7/deals/DL-9106/evidence-pack' },
            { label: 'Connectors', href: '/platform-v7/connectors' },
            { label: 'Logistics', href: '/platform-v7/logistics' },
          ].map((link) => (
            <a key={link.href} href={link.href} style={{ display: 'block', padding: '14px 16px', background: '#fff', color: '#374151', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
