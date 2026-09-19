import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import {
  readVerifiedCabinetRole,
  readVerifiedCabinetSessionRole,
} from '@/lib/platform-v7/verified-session';

const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';

/**
 * Historical compatibility entry.
 *
 * Operator and executive already have separate canonical Design System v8
 * workspaces. The legacy control-tower URL resolves only from the signed
 * cabinet/access JWT and never from URL, query, local storage or client state.
 */
export default async function PlatformV7ControlTowerPage() {
  const secret = String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
  if (!secret) redirect('/platform-v7/login');

  const nowSeconds = Math.floor(Date.now() / 1000);
  const cookieStore = await cookies();
  const role = (
    await readVerifiedCabinetSessionRole(cookieStore.get(CABINET_SESSION_COOKIE)?.value ?? null, secret, nowSeconds)
  ) ?? (
    await readVerifiedCabinetRole(cookieStore.get(ACCESS_COOKIE)?.value ?? null, secret, nowSeconds)
  );

  if (role === 'executive') redirect('/platform-v7/executive');
  redirect('/platform-v7/operator');
}
