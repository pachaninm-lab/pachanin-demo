'use client';

import { usePathname } from 'next/navigation';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ChatSupportWidget } from './ChatSupportWidget';

const PUBLIC_EXACT = new Set([
  '/platform-v7',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/forgot-password',
  '/platform-v7/how-it-works',
  '/platform-v7/secure-grain-deal',
  '/platform-v7/fgis-zerno',
  '/platform-v7/privacy',
  '/platform-v7/terms',
  '/platform-v7/contacts',
  '/platform-v7/contact',
]);

function isPrivateWorkspace(pathname: string): boolean {
  if (!pathname.startsWith('/platform-v7')) return false;
  if (PUBLIC_EXACT.has(pathname)) return false;
  if (pathname.startsWith('/platform-v7/demo')) return false;
  return true;
}

export function ContextualSupportOrAssistant() {
  const pathname = usePathname() || '/platform-v7';
  return isPrivateWorkspace(pathname) ? <AiAssistantPanel variant='floating' /> : <ChatSupportWidget />;
}
