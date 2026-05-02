import Link from 'next/link';
import { canPlatformV7RoleOpenRoute, getPlatformV7RoleHomeRoute, type PlatformV7Role } from '@/lib/platform-v7/role-access';

type RoleRouteHintProps = {
  readonly role: PlatformV7Role;
  readonly route: string;
};

export function RoleRouteHint({ role, route }: RoleRouteHintProps) {
  const decision = canPlatformV7RoleOpenRoute(role, route);
  const homeRoute = getPlatformV7RoleHomeRoute(role);

  return (
    <section data-testid="platform-v7-role-route-hint" style={{ background: decision.allowed ? 'rgba(10,122,95,0.08)' : 'rgba(217,119,6,0.08)', border: `1px solid ${decision.allowed ? 'rgba(10,122,95,0.18)' : 'rgba(217,119,6,0.18)'}`, borderRadius: 16, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: decision.allowed ? '#0A7A5F' : '#B45309', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Роль · {decision.allowed ? 'рабочий экран' : 'лучше открыть свой экран'}
        </div>
        <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.5, color: '#334155' }}>{decision.reason}</div>
      </div>
      {!decision.allowed ? (
        <Link href={homeRoute} style={{ textDecoration: 'none', borderRadius: 10, padding: '9px 12px', background: '#fff', border: '1px solid rgba(217,119,6,0.24)', color: '#B45309', fontSize: 12, fontWeight: 900 }}>
          Открыть свой экран
        </Link>
      ) : null}
    </section>
  );
}
