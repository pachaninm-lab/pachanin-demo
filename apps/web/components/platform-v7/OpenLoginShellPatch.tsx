'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

function ensureBottomRegister(root: ParentNode) {
  const form = root.querySelector('form');
  if (!form || form.querySelector('.bottom-register-patch')) return;
  const link = document.createElement('a');
  link.className = 'bottom-register-patch';
  link.href = '/platform-v7/register';
  link.textContent = 'Зарегистрироваться';
  form.appendChild(link);
}

export function OpenLoginShellPatch() {
  const pathname = usePathname();
  const enabled = pathname === '/platform-v7/open' || pathname === '/platform-v7/login';

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    function sync() {
      if (cancelled) return;
      const root = document.querySelector<HTMLElement>('.pc-clean-login');
      if (!root) return;

      root.dataset.polishedOpenLogin = 'true';
      root.querySelectorAll<HTMLElement>('.recover-note').forEach((item) => item.remove());
      root.querySelectorAll<HTMLElement>('.header-register').forEach((item) => item.remove());
      root.querySelectorAll<HTMLElement>('.forgot-access-panel').forEach((item) => item.remove());
      ensureBottomRegister(root);
    }

    const raf = window.requestAnimationFrame(sync);
    const timers = [80, 240, 700, 1400].map((delay) => window.setTimeout(sync, delay));
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <style>{`
      .pc-clean-login[data-polished-open-login='true'] {
        padding-top: calc(64px + env(safe-area-inset-top)) !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .clean-login-header {
        min-height: calc(56px + env(safe-area-inset-top)) !important;
        padding: calc(7px + env(safe-area-inset-top)) 12px 7px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 9px !important;
        box-shadow: 0 8px 22px rgba(7,22,17,.07) !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-actions {
        order: -1 !important;
        display: flex !important;
        flex: 0 0 auto !important;
        gap: 0 !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-back {
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        min-height: 42px !important;
        padding: 0 !important;
        border-radius: 15px !important;
        font-size: 0 !important;
        background: #fff !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-back svg {
        width: 19px !important;
        height: 19px !important;
        display: block !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-brand {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        gap: 9px !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-brand small {
        display: none !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .header-brand strong {
        font-size: 17px !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .recover-note,
      .pc-clean-login[data-polished-open-login='true'] .header-register,
      .pc-clean-login[data-polished-open-login='true'] .forgot-access-panel {
        display: none !important;
      }
      .pc-clean-login[data-polished-open-login='true'] .forgot-link {
        border: 0 !important;
        background: transparent !important;
        color: #087a32 !important;
        cursor: pointer !important;
        text-decoration: none !important;
      }
      .bottom-register-patch {
        min-height: 56px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 16px;
        font-weight: 950;
        background: #fff;
        color: #087a32 !important;
        border: 1px solid rgba(0,122,47,.20);
      }
      @media (max-width: 720px) {
        .pc-clean-login[data-polished-open-login='true'] {
          padding-top: calc(60px + env(safe-area-inset-top)) !important;
        }
        .pc-clean-login[data-polished-open-login='true'] .clean-login-header {
          min-height: calc(56px + env(safe-area-inset-top)) !important;
        }
      }
    `}</style>
  );
}
