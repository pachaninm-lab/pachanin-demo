import { cookies } from 'next/headers';
import { controlledCabinetContext } from './controlled-test-organizations';
import { parseStaffCapabilitiesContract } from './staff-capabilities';
import {
  readVerifiedCabinetSessionContext,
  type VerifiedCabinetRole,
} from './verified-session';
import { serverApiUrl, serverAuthHeaders } from '../server-api';

const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';

export type VerifiedOwnerControlledCabinet = Readonly<{
  role: VerifiedCabinetRole;
  ownerId: string;
  ownerEmail: string;
  organizationId: string;
  organizationName: string;
  tenantId: string;
  apiRole: string;
}>;

function signingSecret(): string {
  return String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
}

/**
 * Verify the special owner review session without changing normal business auth.
 *
 * Authority requires all of the following at the same time:
 * - a cryptographically verified ownerAccess cabinet token;
 * - the exact controlled test tenant and organization assigned to that role;
 * - the current authenticated identity to have an ACTIVE PLATFORM_OWNER assignment;
 * - the staff capability contract to confirm MFA assurance.
 *
 * This helper never changes the API access token and never impersonates a business
 * membership. Business write endpoints therefore continue to see the real owner
 * identity and keep their ordinary role/tenant authorization rules.
 */
export async function getVerifiedOwnerControlledCabinet(
  expectedRole?: VerifiedCabinetRole,
): Promise<VerifiedOwnerControlledCabinet | null> {
  const secret = signingSecret();
  if (!secret) return null;

  const cookieStore = await cookies();
  const context = await readVerifiedCabinetSessionContext(
    cookieStore.get(CABINET_SESSION_COOKIE)?.value ?? null,
    secret,
    Math.floor(Date.now() / 1000),
  );
  if (!context?.ownerAccess) return null;
  if (expectedRole && context.role !== expectedRole) return null;

  const controlled = controlledCabinetContext(context.role);
  if (
    !controlled
    || context.organizationId !== controlled.organizationId
    || context.tenantId !== controlled.tenantId
  ) return null;

  try {
    const response = await fetch(serverApiUrl('/staff/capabilities/me'), {
      cache: 'no-store',
      headers: await serverAuthHeaders(),
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;

    const capabilities = parseStaffCapabilitiesContract(await response.json());
    if (!capabilities) return null;
    const activeOwner = capabilities.assignments.some((assignment) => (
      assignment.role === 'PLATFORM_OWNER' && assignment.status === 'ACTIVE'
    ));
    if (!activeOwner || !capabilities.authenticationAssurance.mfaVerified) return null;
    if (context.userId && context.userId !== capabilities.identity.id) return null;

    return Object.freeze({
      role: context.role,
      ownerId: capabilities.identity.id,
      ownerEmail: capabilities.identity.email,
      organizationId: controlled.organizationId,
      organizationName: controlled.organizationName,
      tenantId: controlled.tenantId,
      apiRole: controlled.apiRole,
    });
  } catch {
    return null;
  }
}
