import type { BypassRiskProfile } from '../../lib/platform-v7/bypass-risk-score';

export function BypassRiskBadge({ profile }: { profile: BypassRiskProfile }) {
  const color = profile.riskLevel === 'critical' || profile.riskLevel === 'high' ? '#B91C1C' : profile.riskLevel === 'medium' ? '#B45309' : '#0A7A5F';
  return (
    <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', padding: '7px 10px', borderRadius: 999, background: `${color}14`, border: `1px solid ${color}33`, color, fontSize: 12, fontWeight: 900 }}>
      Риск обхода: {profile.totalScore}/100 · {profile.riskLevel}
    </span>
  );
}
