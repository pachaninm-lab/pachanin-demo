'use client';

import { usePathname } from 'next/navigation';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ChatSupportWidget } from './ChatSupportWidget';

const PUBLIC_EXACT = new Set([
  '/platform-v7',
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/forgot-password',
  '/platform-v7/how-it-works',
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/contacts',
  '/platform-v7/request',
  '/platform-v7/docs',
  '/platform-v7/secure-grain-deal',
  '/platform-v7/fgis-zerno',
  '/platform-v7/privacy',
  '/platform-v7/terms',
]);

const PUBLIC_PREFIXES = [
  '/platform-v7/demo/',
  '/platform-v7/role-preview/',
] as const;

function normalize(pathname: string): string {
  const clean = pathname.split('?')[0].replace(/\/+$/u, '');
  return clean || '/platform-v7';
}

function isPrivateWorkspace(pathname: string): boolean {
  const path = normalize(pathname);
  if (!path.startsWith('/platform-v7')) return false;
  if (PUBLIC_EXACT.has(path)) return false;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return false;
  return true;
}

export function ContextualSupportOrAssistant() {
  const pathname = usePathname() || '/platform-v7';
  return isPrivateWorkspace(pathname) ? <AiAssistantPanel variant='floating' /> : <ChatSupportWidget />;
}
