'use client';

import { useEffect } from 'react';

function forceRail(actions: Element | null) {
  if (!(actions instanceof HTMLElement)) return;
  const rail = actions.querySelector<HTMLElement>('.p7-mobile-action-rail');
  if (rail) {
    rail.style.setProperty('display', 'grid', 'important');
    rail.style.setProperty('visibility', 'visible', 'important');
    rail.style.setProperty('inline-size', 'max-content', 'important');
  }

  for (const selector of ['.p7-note-widget', '.p7-calc-widget', '.pc-v7-notice-wrap']) {
    const node = actions.querySelector<HTMLElement>(selector);
    if (node) {
      node.style.setProperty('display', 'contents', 'important');
    }
  }
}

export function MobileHeaderRailRescue() {
  useEffect(() => {
    const actions = document.querySelector('.pc-v4-header .pc-v4-actions');
    forceRail(actions);
    const observer = new MutationObserver(() => forceRail(document.querySelector('.pc-v4-header .pc-v4-actions')));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => forceRail(document.querySelector('.pc-v4-header .pc-v4-actions')));
    window.addEventListener('orientationchange', () => forceRail(document.querySelector('.pc-v4-header .pc-v4-actions')));
    return () => observer.disconnect();
  }, []);

  return null;
}
