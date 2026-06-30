import { redirect } from 'next/navigation';
import { platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const roles: PlatformRole[] = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'compliance', 'arbitrator', 'executive'];
const publicDestinations = new Set(['/platform-v7/demo', '/platform-v7/contact', '/platform-v7/request', '/platform-v7/register']);

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isRole(value: string | null): value is PlatformRole {
  return Boolean(value && roles.includes(value as PlatformRole));
}

function cleanPath(value: string | null) {
  return value?.split('?')[0].replace(/\/$/, '') ?? null;
}

function hrefFromParams(params: SearchParams): string {
  const rawNext = first(params.next) || first(params.redirect);
  const cleanNext = cleanPath(rawNext);
  if (cleanNext && publicDestinations.has(cleanNext)) return rawNext || cleanNext;

  const roleParam = first(params.role);
  const asParam = first(params.as);
  const role = isRole(roleParam) ? roleParam : isRole(asParam) ? asParam : 'seller';
  const next = rawNext && rawNext.startsWith('/platform-v7') && !rawNext.startsWith('/platform-v7/login') && !rawNext.startsWith('/platform-v7/open') ? rawNext : platformV7RoleRoute(role);
  return `/platform-v7/open?${new URLSearchParams({ role, next }).toString()}`;
}

export default async function PlatformV7LoginRedirectPage({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams }) {
  const params = await Promise.resolve(searchParams ?? {});
  redirect(hrefFromParams(params));
}
