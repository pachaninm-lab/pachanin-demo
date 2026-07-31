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
import '@/styles/platform-v7-public-assistant-polish.css';

const ASSISTANT_WORKSPACE = '/platform-v7/assistant';
const AI_IN_ACTION = '/platform-v7/ai-in-action';
const PUBLIC_HOME = '/platform-v7';
const PUBLIC_ENTRY_REWRITE_PREFIX = '/pc-public-entry';
const KEYBOARD_DELTA_PX = 120;

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
    let unfocusedVisualHeight = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
    let unfocusedInnerHeight = Math.max(1, Math.round(window.innerHeight));
    let unfocusedVisualTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));

    const isComposerTextarea = (target: EventTarget | null): target is HTMLTextAreaElement => (
      target instanceof HTMLTextAreaElement
      && Boolean(target.closest('.pc-public-assistant-composer'))
    );

    const clearFocusTimers = () => {
      for (const timer of focusTimers) window.clearTimeout(timer);
      focusTimers = [];
    };

    const clearPanelViewport = (panel: HTMLElement | null) => {
      if (!panel) return;
      delete panel.dataset.pcKeyboardFocus;
      delete panel.dataset.pcKeyboardViewport;
      delete panel.dataset.pcKeyboardGeometry;
      panel.style.removeProperty('--pc-ai-visible-top');
      panel.style.removeProperty('--pc-ai-visible-height');
      panel.style.removeProperty('--pc-ai-keyboard-top');
      panel.style.removeProperty('--pc-ai-keyboard-height');
      panel.style.removeProperty('--pc-ai-keyboard-bottom');
      panel.style.removeProperty('--pc-ai-keyboard-inset');
    };

    const measure = () => {
      frame = 0;
      const innerHeight = Math.max(1, Math.round(window.innerHeight));
      const visualHeight = Math.max(1, Math.round(viewport?.height ?? innerHeight));
      const visualTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
      const visualBottom = visualTop + visualHeight;
      const innerBottom = Math.max(visualTop + 1, innerHeight);
      const layoutBottom = Math.max(
        visualBottom,
        innerHeight,
        Math.round(root.clientHeight),
      );
      const keyboardHeight = Math.max(0, Math.round(virtualKeyboard?.boundingRect?.height ?? 0));
      const panel = document.querySelector<HTMLElement>('.pc-public-assistant-panel');
      const focused = isComposerTextarea(document.activeElement);
      const mobile = window.matchMedia('(max-width: 720px)').matches;

      const visualKeyboardDelta = Math.max(0, unfocusedVisualHeight - visualHeight);
      const innerKeyboardDelta = Math.max(0, unfocusedInnerHeight - innerHeight);
      let visibleBottom = visualBottom;
      let geometry = 'visual-viewport';

      if (mobile && focused) {
        const keyboardAwareBottoms: number[] = [];
        if (visualKeyboardDelta >= KEYBOARD_DELTA_PX) keyboardAwareBottoms.push(visualBottom);
        if (innerKeyboardDelta >= KEYBOARD_DELTA_PX) keyboardAwareBottoms.push(innerBottom);

        const keyboardAwareBottom = keyboardAwareBottoms.length
          ? Math.max(...keyboardAwareBottoms)
          : visualBottom;

        if (keyboardHeight > 0) {
          const keyboardTopFromHeight = Math.max(visualTop + 1, layoutBottom - keyboardHeight);
          // VirtualKeyboard geometry is an upper safety bound. Resize-aware
          // metrics may reclaim browser chrome, but never cross the keyboard.
          visibleBottom = Math.max(
            visualTop + 1,
            Math.min(keyboardAwareBottom, keyboardTopFromHeight),
          );
          geometry = keyboardAwareBottoms.length > 1
            ? 'keyboard-height+resize-metrics'
            : 'keyboard-height';
        } else if (keyboardAwareBottoms.length) {
          // Yandex/WebKit may keep hidden bottom browser chrome subtracted from
          // visualViewport while window.innerHeight exposes the actual usable
          // edge. Both metrics must first prove a keyboard-sized contraction;
          // then the later safe edge removes the dead strip above the keyboard.
          const baselineBottom = Math.max(
            unfocusedVisualTop + unfocusedVisualHeight,
            unfocusedInnerHeight,
          );
          const maximumVisibleBottom = Math.max(
            visualTop + 1,
            baselineBottom - KEYBOARD_DELTA_PX,
          );
          visibleBottom = Math.max(
            visualTop + 1,
            Math.min(keyboardAwareBottom, maximumVisibleBottom),
          );
          geometry = visualKeyboardDelta >= KEYBOARD_DELTA_PX
            && innerKeyboardDelta >= KEYBOARD_DELTA_PX
            ? 'visual-viewport+window-inner-height'
            : innerKeyboardDelta >= KEYBOARD_DELTA_PX
              ? 'window-inner-height'
              : 'visual-viewport';
        }
      }

      const visibleHeight = Math.max(1, visibleBottom - visualTop);
      const activeHeight = mobile && focused ? visibleHeight : visualHeight;
      const hiddenBottom = Math.max(0, layoutBottom - (mobile && focused ? visibleBottom : visualBottom));

      if (mobile && !focused) {
        unfocusedVisualHeight = visualHeight;
        unfocusedInnerHeight = innerHeight;
        unfocusedVisualTop = visualTop;
      }

      root.style.setProperty('--pc-visual-viewport-height', `${activeHeight}px`);
      root.style.setProperty('--pc-visual-viewport-top', `${visualTop}px`);
      root.style.setProperty('--pc-visual-viewport-bottom', `${hiddenBottom}px`);

      if (!mobile || !panel) {
        clearPanelViewport(panel);
        return;
      }

      panel.style.setProperty('--pc-ai-visible-top', `${visualTop}px`);
      panel.style.setProperty('--pc-ai-visible-height', `${activeHeight}px`);

      if (!focused) {
        delete panel.dataset.pcKeyboardFocus;
        delete panel.dataset.pcKeyboardViewport;
        delete panel.dataset.pcKeyboardGeometry;
        return;
      }

      panel.dataset.pcKeyboardFocus = 'true';
      panel.dataset.pcKeyboardViewport = 'true';
      panel.dataset.pcKeyboardGeometry = geometry;
    };

    const scheduleMeasure = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const scheduleFocusMeasure = () => {
      clearFocusTimers();
      scheduleMeasure();
      focusTimers = [40, 100, 180, 300, 480, 700, 1_000, 1_400, 1_900]
        .map((delay) => window.setTimeout(scheduleMeasure, delay));
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isComposerTextarea(event.target)) scheduleFocusMeasure();
      else scheduleMeasure();
    };

    const handleFocusOut = () => {
      clearFocusTimers();
      focusTimers = [0, 80, 180, 360]
        .map((delay) => window.setTimeout(scheduleMeasure, delay));
    };

    measure();
    viewport?.addEventListener('resize', scheduleMeasure);
    viewport?.addEventListener('scroll', scheduleMeasure);
    virtualKeyboard?.addEventListener('geometrychange', scheduleMeasure);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleFocusMeasure);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      clearFocusTimers();
      viewport?.removeEventListener('resize', scheduleMeasure);
      viewport?.removeEventListener('scroll', scheduleMeasure);
      virtualKeyboard?.removeEventListener('geometrychange', scheduleMeasure);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleFocusMeasure);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      clearPanelViewport(document.querySelector<HTMLElement>('.pc-public-assistant-panel'));
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

  return (
    <>
      <UnifiedModalSheetFullscreenController />
      <PublicPlatformAssistant />
      <ChatSupportWidget />
      {renderDock ? <PublicContactDock /> : null}
    </>
  );
}