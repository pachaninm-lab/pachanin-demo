import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import type { PlatformV7AccessActor, PlatformV7AccessRole } from '@/lib/platform-v7/access-control';
import {
  evaluatePlatformV7RouteGuard,
  platformV7RouteGuardRequest,
  type PlatformV7GuardedSurface,
} from '@/lib/platform-v7/rbac-route-guard';
import { toPlatformV7CanonicalRole } from '@/lib/platform-v7/role-canonical';

const SURFACE_ROLE: Record<PlatformV7GuardedSurface, PlatformV7AccessRole> = {
  driver_field: 'driver',
  bank_workspace: 'bankOfficer',
  executive_workspace: 'executiveViewer',
};

const ROLE_ACTOR: Partial<Record<PlatformV7AccessRole, PlatformV7AccessActor>> = {
  driver: { userId: 'driver-1', organizationId: 'carrier-1', roles: ['driver'], activeRole: 'driver' },
  bankOfficer: { userId: 'bank-1', organizationId: 'bank-1', roles: ['bankOfficer'], activeRole: 'bankOfficer' },
  executiveViewer: { userId: 'executive-1', organizationId: 'exec-1', roles: ['executiveViewer'], activeRole: 'executiveViewer' },
};

async function roleFromCookie(surface: PlatformV7GuardedSurface): Promise<PlatformV7AccessRole> {
  const cookieRole = (await cookies()).get('pc-role')?.value;
  if (!cookieRole) return SURFACE_ROLE[surface];

  const canonical = toPlatformV7CanonicalRole(cookieRole);
  if (canonical === 'driver') return 'driver';
  if (canonical === 'bank_officer') return 'bankOfficer';
  if (canonical === 'executive_viewer') return 'executiveViewer';
  if (canonical === 'operator') return 'operator';
  if (canonical === 'seller') return 'seller';
  if (canonical === 'buyer') return 'buyer';
  if (canonical === 'support_agent') return 'support_agent';
  if (canonical === 'arbitrator') return 'arbitrator';
  if (canonical === 'investor') return 'investor';
  return SURFACE_ROLE[surface];
}

function actorForRole(role: PlatformV7AccessRole): PlatformV7AccessActor {
  return ROLE_ACTOR[role] ?? {
    userId: `${role}-user`,
    organizationId: `${role}-org`,
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
  const actor = actorForRole(await roleFromCookie(surface));
  const result = evaluatePlatformV7RouteGuard(platformV7RouteGuardRequest(surface, actor));

  if (!result.allowed) {
    return (
      <section data-testid={`platform-v7-rbac-denied-${surface}`} style={deniedShell}>
        <h1 style={title}>Доступ ограничен</h1>
        <p style={text}>Текущая роль не имеет доступа к {surfaceLabel(surface)} в рамках серверной политики доступа.</p>
        <div style={nextStep}>
          Откройте свой кабинет или вернитесь к сделкам. Техническая запись отказа сохраняется во внутреннем журнале платформы.
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
