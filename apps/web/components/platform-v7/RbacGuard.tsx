import type { ReactNode } from 'react';
import { getAuthProfile } from '@/lib/auth-profile-server';
import type { PlatformV7AccessActor, PlatformV7AccessRole } from '@/lib/platform-v7/access-control';
import {
  evaluatePlatformV7RouteGuard,
  platformV7RouteGuardRequest,
  type PlatformV7GuardedSurface,
} from '@/lib/platform-v7/rbac-route-guard';
function accessRole(apiRole: string): PlatformV7AccessRole | null {
  if (apiRole === 'DRIVER') return 'driver';
  if (apiRole === 'ACCOUNTING') return 'bankOfficer';
  if (apiRole === 'EXECUTIVE') return 'executiveViewer';
  if (apiRole === 'ADMIN') return 'operator';
  if (apiRole === 'FARMER') return 'seller';
  if (apiRole === 'BUYER') return 'buyer';
  if (apiRole === 'ARBITRATOR') return 'arbitrator';
  return null;
}

async function actorFromServerSession(): Promise<PlatformV7AccessActor | null> {
  const profile = await getAuthProfile();
  const role = profile.role ? accessRole(profile.role) : null;
  if (!profile.available || !profile.id || !profile.orgId || !role) return null;
  return {
    userId: profile.id,
    organizationId: profile.orgId,
    roles: [role],
    activeRole: role,
  };
}

function surfaceLabel(surface: PlatformV7GuardedSurface) {
  if (surface === 'bank_workspace') return 'денежному контуру';
  if (surface === 'driver_field') return 'полевому контуру';
  return 'сводному контуру';
}

export async function RbacGuard({ surface, children }: { surface: PlatformV7GuardedSurface; children: ReactNode }) {
  const actor = await actorFromServerSession();
  const result = actor
    ? evaluatePlatformV7RouteGuard(platformV7RouteGuardRequest(surface, actor))
    : { allowed: false };

  if (!result.allowed) {
    return (
      <section data-testid={`platform-v7-rbac-denied-${surface}`} style={deniedShell}>
        <h1 style={title}>Доступ ограничен</h1>
        <p style={text}>Текущая роль не имеет доступа к {surfaceLabel(surface)} в рамках серверной политики доступа.</p>
        <div style={nextStep}>
          Открой свой кабинет или вернись к сделкам. Техническая запись отказа сохраняется во внутреннем журнале платформы.
        </div>
      </section>
    );
  }

  return <>{children}</>;
}

const deniedShell = {
  display: 'grid',
  gap: 12,
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#7F1D1D',
  borderRadius: 16,
  padding: 16,
} as const;

const title = {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 900,
} as const;

const text = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.45,
} as const;

const nextStep = {
  padding: '10px 12px',
  borderRadius: 12,
  background: '#FFFFFF',
  border: '1px solid #FECACA',
  color: '#991B1B',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
} as const;
