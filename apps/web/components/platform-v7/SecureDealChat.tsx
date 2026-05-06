import { scanMessageForLeaks } from '../../lib/platform-v7/anti-leak-filter';
import { calculateBypassRiskProfile, mapLeakFindingToSignal } from '../../lib/platform-v7/bypass-risk-score';
import { BypassRiskBadge } from './BypassRiskBadge';

export function SecureDealChat({ text, actorId, counterpartyId }: { text: string; actorId: string; counterpartyId: string }) {
  const scan = scanMessageForLeaks(text);
  const signals = scan.findings.map((finding) => mapLeakFindingToSignal(finding, actorId, 'buyer', counterpartyId));
  const profile = calculateBypassRiskProfile(counterpartyId, signals);
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 14, display: 'grid', gap: 10 }}>
      <strong style={{ color: '#0F1419', fontSize: 16 }}>Чат сделки</strong>
      <p style={{ margin: 0, color: '#475569', fontSize: 13, lineHeight: 1.5 }}>{scan.safeText}</p>
      <BypassRiskBadge profile={profile} />
      <span style={{ color: '#64748B', fontSize: 12 }}>Действие проверки: {scan.action}</span>
    </div>
  );
}
