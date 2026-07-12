import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { CABINET_SESSION_COOKIE } from '@/lib/server/auth-session-response';
import { platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import {
  readVerifiedCabinetRole,
  readVerifiedCabinetSessionRole,
} from '@/lib/platform-v7/verified-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const secret = String(process.env.JWT_SECRET || process.env.PC_CABINET_SESSION_SECRET || '').trim();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const verifiedRole = secret
    ? (await readVerifiedCabinetSessionRole(
        cookieStore.get(CABINET_SESSION_COOKIE)?.value,
        secret,
        nowSeconds,
      ))
      ?? (await readVerifiedCabinetRole(
        cookieStore.get(ACCESS_COOKIE)?.value,
        secret,
        nowSeconds,
      ))
    : null;

  if (!verifiedRole) {
    redirect('/platform-v7/login?next=%2Fplatform-v7%2Fdriver%2Ffield');
  }

  if (verifiedRole !== 'driver') {
    redirect(platformV7RoleRoute(verifiedRole));
  }

  return children;
}
