'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { platformV7RoleHome } from '@/components/platform-v7/PlatformV7SingleEntryGuard';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const roles: PlatformRole[] = ['operator','buyer','seller','logistics','driver','elevator','lab','surveyor','bank','compliance','arbitrator','executive'];

function isRole(value: string | null): value is PlatformRole {
  return Boolean(value && roles.includes(value as PlatformRole));
}

function hrefFromParams(params: URLSearchParams): string {
  const role = isRole(params.get('role')) ? params.get('role') as PlatformRole : isRole(params.get('as')) ? params.get('as') as PlatformRole : 'seller';
  const rawNext = params.get('next') || params.get('redirect');
  const next = rawNext && rawNext.startsWith('/platform-v7') && !rawNext.startsWith('/platform-v7/login') ? rawNext : platformV7RoleHome(role);
  return `/platform-v7/open?${new URLSearchParams({ role, next }).toString()}`;
}

export default function PlatformV7LoginRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const href = React.useMemo(() => hrefFromParams(new URLSearchParams(searchParams.toString())), [searchParams]);

  React.useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>Открываю форму входа…</main>;
}
