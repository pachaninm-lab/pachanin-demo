'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AiAssistantPanel } from './AiAssistantPanel';
import { CabinetContactDock } from './CabinetContactDock';
import { ChatSupportWidget } from './ChatSupportWidget';
import { PublicContactDock } from './PublicContactDock';
import { PublicPlatformAssistant } from './PublicPlatformAssistant';
import { UnifiedModalSheetFullscreenController } from './UnifiedModalSheetFullscreenController';
import { installPublicAssistantFetchResilience } from '@/lib/platform-v7/install-public-assistant-fetch-resilience';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import '@/styles/platform-v7-public-assistant.css';
import '@/styles/platform-v7-public-assistant-shortcut.css';
import '@/styles/platform-v7-public-assistant-mobile-fix.css';
import '@/styles/platform-v7-unified-modal-fullscreen.css';

const ASSISTANT_WORKSPACE = '/platform-v7/assistant';
const AI_IN_ACTION = '/platform-v7/ai-in-action';
const PUBLIC_HOME = '/platform-v7';
const PUBLIC_ENTRY_REWRITE_PREFIX = '/pc-public-entry';

const PUBLIC_EXACT = new Set([
  PUBLIC_HOME,
  '/platform-v7/open',
  '/platform-v7/login',
  '/platform-v7/register',
  '/platform-v7/forgot-password',
  '/platform-v7/how-it-works',
  AI_IN_ACTION,
  '/platform-v7/help',
  '/platform-v7/pricing',
  '/platform-v7/roadmap',
  '/platform-v7/deal-flow',
  '/platform-v7/demo',
  '/platform-v7/contact',
  '/platform-v7/contacts',
  '/platform-v7/request',
  '/platform-v7/docs',
  '/platform-v7/about',
  '/platform-v7/oferta',
  '/platform-v7/roles',
  '/platform-v7/secure-grain-deal',
  '/platform-v7/grain-logistics',
  '/platform-v7/grain-quality',
  '/platform-v7/grain-documents',
  '/platform-v7/grain-payment',
  '/platform-v7/fgis-zerno',
  '/platform-v7/privacy',
  '/platform-v7/terms',
]);

const PUBLIC_PREFIXES = [
  '/platform-v7/demo',
  '/platform-v7/role-preview',
] as const;

function normalize(pathname: string): string {
  const clean = pathname.split('?')[0].replace(/\/+$/u, '');
  const rewrittenHome = `${PUBLIC_ENTRY_REWRITE_PREFIX}${PUBLIC_HOME}`;

  if (!clean || clean === '/') return PUBLIC_HOME;
  if (clean === rewrittenHome || clean.startsWith(`${rewrittenHome}/`)) {
    return clean.slice(PUBLIC_ENTRY_REWRITE_PREFIX.length) || PUBLIC_HOME;
  }
  return clean;
}

function isPrivateWorkspace(pathname: string): boolean {
  const path = normalize(pathname);
  if (!path.startsWith('/platform-v7')) return false;
  if (PUBLIC_EXACT.has(path)) return false;
  if (PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return false;
  return true;
}

function useVisualViewportMetrics() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;

    const sync = () => {
      frame = 0;
      const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const hiddenBottom = Math.max(0, Math.round(window.innerHeight - offsetTop - height));

      root.style.setProperty('--pc-visual-viewport-height', `${height}px`);
      root.style.setProperty('--pc-visual-viewport-top', `${offsetTop}px`);
      root.style.setProperty('--pc-visual-viewport-bottom', `${hiddenBottom}px`);
    };

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    viewport?.addEventListener('resize', scheduleSync);
    viewport?.addEventListener('scroll', scheduleSync);
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('orientationchange', scheduleSync);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', scheduleSync);
      viewport?.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('orientationchange', scheduleSync);
      root.style.removeProperty('--pc-visual-viewport-height');
      root.style.removeProperty('--pc-visual-viewport-top');
      root.style.removeProperty('--pc-visual-viewport-bottom');
    };
  }, []);
}

export function ContextualSupportOrAssistant({
  verifiedRole,
  renderDock = true,
}: {
  verifiedRole?: PlatformRole;
  renderDock?: boolean;
}) {
  installPublicAssistantFetchResilience();
  useVisualViewportMetrics();
  const routerPathname = usePathname() || PUBLIC_HOME;
  const browserPathname = typeof window === 'undefined' ? routerPathname : window.location.pathname;
  const path = normalize(browserPathname || routerPathname);

  // The explainer is itself the active AI surface. Suppress every floating AI,
  // support and call launcher here so the animation and result remain unobstructed.
  if (path === AI_IN_ACTION) return null;

  // The full-page assistant already renders its own workspace panel. Keep the
  // shared dock for human support and phone access, while the AI action focuses
  // that existing panel instead of creating a duplicate floating assistant.
  if (path === ASSISTANT_WORKSPACE) {
    return (
      <>
        <UnifiedModalSheetFullscreenController />
        <ChatSupportWidget />
        {renderDock && verifiedRole
          ? <CabinetContactDock role={verifiedRole} assistantContext='workspace' />
          : null}
      </>
    );
  }

  if (isPrivateWorkspace(path)) {
    return (
      <>
        <UnifiedModalSheetFullscreenController />
        <AiAssistantPanel variant='floating' />
        <ChatSupportWidget />
        {renderDock && verifiedRole
          ? <CabinetContactDock role={verifiedRole} assistantContext='private' />
          : null}
      </>
    );
  }

  // Every public platform surface uses one visible entry point. The standalone
  // assistant and support launchers remain internal triggers for the shared dock.
  return (
    <>
      <UnifiedModalSheetFullscreenController />
      <PublicPlatformAssistant />
      <ChatSupportWidget />
      {renderDock ? <PublicContactDock /> : null}
    </>
  );
}
