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
import '@/styles/platform-v7-public-assistant-mobile-hotfix.css';

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

type VirtualKeyboardLike = EventTarget & {
  boundingRect?: DOMRectReadOnly;
  overlaysContent?: boolean;
};

type NavigatorWithVirtualKeyboard = Navigator & {
  virtualKeyboard?: VirtualKeyboardLike;
};

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
    const virtualKeyboard = (navigator as NavigatorWithVirtualKeyboard).virtualKeyboard;
    let frame = 0;
    let focusTimers: number[] = [];
    let composerFocused = false;
    let focusBaselineHeight = 0;
    let previousKeyboardOverlay: boolean | null = null;
    let stableViewportHeight = Math.max(
      window.innerHeight,
      root.clientHeight,
      Math.round(viewport?.height ?? 0),
    );

    const isComposerTextarea = (target: EventTarget | null): target is HTMLTextAreaElement => (
      target instanceof HTMLTextAreaElement
      && Boolean(target.closest('.pc-public-assistant-composer'))
    );

    const clearFocusTimers = () => {
      for (const timer of focusTimers) window.clearTimeout(timer);
      focusTimers = [];
    };

    const setVirtualKeyboardOverlay = (enabled: boolean) => {
      if (!virtualKeyboard || !('overlaysContent' in virtualKeyboard)) return;
      try {
        if (enabled) {
          if (previousKeyboardOverlay === null) {
            previousKeyboardOverlay = Boolean(virtualKeyboard.overlaysContent);
          }
          virtualKeyboard.overlaysContent = true;
        } else if (previousKeyboardOverlay !== null) {
          virtualKeyboard.overlaysContent = previousKeyboardOverlay;
          previousKeyboardOverlay = null;
        }
      } catch {
        // Some Chromium shells expose a read-only partial API. visualViewport stays authoritative.
      }
    };

    const clearKeyboardViewport = (panel: HTMLElement | null) => {
      if (!panel) return;
      delete panel.dataset.pcKeyboardViewport;
      panel.style.removeProperty('--pc-ai-keyboard-top');
      panel.style.removeProperty('--pc-ai-keyboard-height');
    };

    const clearKeyboardFocus = (panel: HTMLElement | null) => {
      if (!panel) return;
      delete panel.dataset.pcKeyboardFocus;
      panel.style.removeProperty('--pc-ai-keyboard-inset');
      clearKeyboardViewport(panel);
    };

    const readViewport = () => {
      const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
      const offsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const layoutHeight = Math.max(1, Math.round(window.innerHeight), Math.round(root.clientHeight));
      const visualBottom = offsetTop + height;
      const keyboardRect = virtualKeyboard?.boundingRect;
      const keyboardHeight = Math.max(0, Math.round(keyboardRect?.height ?? 0));
      const rawKeyboardTop = Math.round(keyboardRect?.top ?? visualBottom);
      const keyboardTop = keyboardHeight > 0 && rawKeyboardTop > offsetTop + 48
        ? rawKeyboardTop
        : Number.POSITIVE_INFINITY;

      return {
        height,
        offsetTop,
        layoutHeight,
        visualBottom,
        keyboardHeight,
        keyboardTop,
      };
    };

    const sync = () => {
      frame = 0;
      const {
        height,
        offsetTop,
        layoutHeight,
        visualBottom,
        keyboardHeight,
        keyboardTop,
      } = readViewport();
      const hiddenBottom = Math.max(0, layoutHeight - visualBottom);

      root.style.setProperty('--pc-visual-viewport-height', `${height}px`);
      root.style.setProperty('--pc-visual-viewport-top', `${offsetTop}px`);
      root.style.setProperty('--pc-visual-viewport-bottom', `${hiddenBottom}px`);

      const panel = document.querySelector<HTMLElement>('.pc-public-assistant-panel');
      const focused = composerFocused || isComposerTextarea(document.activeElement);
      const mobile = window.matchMedia('(max-width: 720px)').matches;

      if (!focused) {
        stableViewportHeight = Math.max(stableViewportHeight, layoutHeight, visualBottom);
        focusBaselineHeight = 0;
        clearKeyboardFocus(panel);
        return;
      }

      composerFocused = true;
      if (!focusBaselineHeight) {
        focusBaselineHeight = Math.max(stableViewportHeight, layoutHeight, visualBottom);
      }
      const baselineHeight = Math.max(stableViewportHeight, focusBaselineHeight);
      const fallbackKeyboardTop = Math.max(offsetTop + 1, baselineHeight - keyboardHeight);
      const measuredKeyboardTop = keyboardHeight > 0
        ? Math.min(visualBottom, Number.isFinite(keyboardTop) ? keyboardTop : fallbackKeyboardTop)
        : visualBottom;
      const visibleBottom = Math.max(offsetTop + 1, measuredKeyboardTop);
      const keyboardInset = Math.max(
        hiddenBottom,
        baselineHeight - visualBottom,
        baselineHeight - layoutHeight,
        keyboardHeight,
      );
      const keyboardOpen = mobile && (
        keyboardInset > 64
        || visibleBottom < Math.round(baselineHeight * 0.9)
      );

      if (panel) {
        panel.dataset.pcKeyboardFocus = 'true';
        panel.style.setProperty('--pc-ai-keyboard-inset', `${keyboardInset}px`);
      }

      if (!keyboardOpen || !panel) {
        clearKeyboardViewport(panel);
        return;
      }

      const usableHeight = Math.max(1, visibleBottom - offsetTop - 2);
      panel.dataset.pcKeyboardViewport = 'true';
      panel.style.setProperty('--pc-ai-keyboard-top', `${offsetTop}px`);
      panel.style.setProperty('--pc-ai-keyboard-height', `${usableHeight}px`);
    };

    const scheduleSync = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(sync);
    };

    const scheduleFocusSync = () => {
      clearFocusTimers();
      scheduleSync();
      focusTimers = [60, 140, 260, 420, 700, 1_000]
        .map((delay) => window.setTimeout(scheduleSync, delay));
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isComposerTextarea(event.target)) {
        const current = readViewport();
        composerFocused = true;
        focusBaselineHeight = Math.max(
          stableViewportHeight,
          current.layoutHeight,
          current.visualBottom,
        );
        setVirtualKeyboardOverlay(true);
      }
      scheduleFocusSync();
    };

    const handleFocusOut = () => {
      clearFocusTimers();
      focusTimers = [window.setTimeout(() => {
        composerFocused = isComposerTextarea(document.activeElement);
        if (!composerFocused) {
          focusBaselineHeight = 0;
          setVirtualKeyboardOverlay(false);
        }
        scheduleFocusSync();
      }, 0)];
    };

    sync();
    viewport?.addEventListener('resize', scheduleSync);
    viewport?.addEventListener('scroll', scheduleSync);
    virtualKeyboard?.addEventListener('geometrychange', scheduleSync);
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('orientationchange', scheduleSync);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      clearFocusTimers();
      viewport?.removeEventListener('resize', scheduleSync);
      viewport?.removeEventListener('scroll', scheduleSync);
      virtualKeyboard?.removeEventListener('geometrychange', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('orientationchange', scheduleSync);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      setVirtualKeyboardOverlay(false);
      clearKeyboardFocus(document.querySelector<HTMLElement>('.pc-public-assistant-panel'));
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

  // Every public platform surface, including the TAI passport, keeps the single
  // visible AI / support / call dock. The standalone launchers stay internal.
  return (
    <>
      <UnifiedModalSheetFullscreenController />
      <PublicPlatformAssistant />
      <ChatSupportWidget />
      {renderDock ? <PublicContactDock /> : null}
    </>
  );
}
