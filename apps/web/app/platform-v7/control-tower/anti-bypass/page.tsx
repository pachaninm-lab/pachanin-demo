import { OperatorBypassQueue } from '../../../../components/platform-v7/OperatorBypassQueue';
import { BypassRiskBadge } from '../../../../components/platform-v7/BypassRiskBadge';
import { calculateBypassRiskProfile, type BypassSignal } from '../../../../lib/platform-v7/bypass-risk-score';

const signals: BypassSignal[] = [
  { id: 'BYP-1', dealId: 'DL-9106', actorId: 'BUYER-1', actorRole: 'buyer', counterpartyId: 'SELLER-1', signalType: 'document_request_without_progress', riskLevel: 'medium', source: 'document', description: 'Много запросов материалов без перехода к следующему шагу.', createdAt: '2026-05-06T00:00:00.000Z' },
  { id: 'BYP-2', lotId: 'LOT-2403', actorId: 'SELLER-1', actorRole: 'seller', counterpartyId: 'BUYER-1', signalType: 'contact_reveal_then_inactivity', riskLevel: 'high', source: 'system', description: 'После раскрытия части данных движение по сделке остановилось.', createdAt: '2026-05-06T00:10:00.000Z' },
];

export default function ControlTowerAntiBypassPage() {
  const profile = calculateBypassRiskProfile('BUYER-1', signals);
  return (
    <main style={{ display: 'grid', gap: 14, padding: '4px 0 24px' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ color: '#B91C1C', fontSize: 12, fontWeight: 900 }}>Центр управления · антиобход</div>
        <h1 style={{ margin: 0, color: '#0F1419', fontSize: 'clamp(30px,8vw,48px)', lineHeight: 1.03, letterSpacing: '-0.045em', fontWeight: 950 }}>Очередь сигналов риска</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.55 }}>Оператор видит объект сделки, тип сигнала, уровень риска, ограничения и следующий шаг. Каждое решение должно иметь основание и запись в журнале.</p>
        <BypassRiskBadge profile={profile} />
      </section>
      <OperatorBypassQueue signals={signals} />
    </main>
  );
}
