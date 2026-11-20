'use client';

import * as React from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], select, input, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal keyboard contract shared by the Gekta dialogs: focus moves inside on
 * open, Tab cycles within the panel, Escape closes, and focus returns to
 * whatever opened it after modal isolation has been removed.
 */
export function useDialogFocus(active: boolean, onClose: () => void, returnFocus?: HTMLElement | (() => HTMLElement | null) | null) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef(onClose);
  React.useEffect(() => { closeRef.current = onClose; }, [onClose]);

  React.useEffect(() => {
    if (!active) return undefined;
    const opener = document.activeElement;
    const panel = panelRef.current;
    const initial = panel?.querySelector<HTMLElement>('[data-gekta-initial-focus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => node.offsetParent !== null || node === document.activeElement);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!(document.activeElement instanceof HTMLElement) || !focusable.includes(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (focused?.closest('[role="dialog"][aria-modal="true"], dialog[open]')) return;
        // A tap or a keyboard action can move focus after isolation ends but before this frame.
        if (focused instanceof HTMLElement && focused !== document.body && focused !== document.documentElement &&
            !panel?.contains(focused) && !focused.closest('[inert]')) return;
        const restore = typeof returnFocus === 'function' ? returnFocus() : returnFocus ?? opener;
        if (restore instanceof HTMLElement && restore.isConnected && !restore.closest('[inert]')) {
          restore.focus({ preventScroll: true });
        }
      });
    };
  }, [active, returnFocus]);

  return panelRef;
}
