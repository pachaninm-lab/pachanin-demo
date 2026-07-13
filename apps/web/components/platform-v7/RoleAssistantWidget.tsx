'use client';

import { usePathname } from 'next/navigation';
import { UxFinalQuietLayer } from '@/components/platform-v7/UxFinalQuietLayer';
import { WorkStepGuide } from '@/components/platform-v7/WorkStepGuide';
import './RoleAssistantWidget.module.css';

const PUBLIC_PATHS = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/request',
  '/platform-v7/docs',
]);

function normalize(pathname: string | null) {
  if (!pathname) return '/platform-v7';
  return pathname.split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

export function RoleAssistantWidget() {
  const pathname = usePathname();
  const path = normalize(pathname);

  if (PUBLIC_PATHS.has(path) || path.startsWith('/platform-v7/role-preview')) return null;

  return (
    <>
      <UxFinalQuietLayer />
      <WorkStepGuide />
    </>
  );
}
