'use client';

import * as React from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], select, input, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal keyboard contract shared by the Gekta dialogs: focus moves inside on
 * open, Tab cycles within the panel, Escape closes, and focus returns to
 * whatever opened it after modal isolation has been removed.
 */
export function useDialogFocus(active: boolean, onClose: () => void) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!active) return undefined;
    const restore = document.activeElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((node) => node.offsetParent !== null || node === document.activeElement);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
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
        if (restore instanceof HTMLElement && restore.isConnected && !restore.closest('[inert]')) restore.focus();
      });
    };
  }, [active, onClose]);

  return panelRef;
}
