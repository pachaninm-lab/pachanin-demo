'use client';

import * as React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

function tourLayer() {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>('.p7-public-tour-layer');
}

function clickFirstStep() {
  document.querySelector<HTMLButtonElement>('.p7-public-tour-node')?.click();
  document.querySelector<HTMLElement>('.p7-public-tour-dialog')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function clickClose() {
  document.querySelector<HTMLButtonElement>('.p7-public-tour-close')?.click();
}

export function PublicTourControlPatch() {
  const pathname = usePathname();
  const [visible, setVisible] = React.useState(false);
  const isPublicEntry = pathname === '/platform-v7' || pathname === '/platform-v7/';

  React.useEffect(() => {
    if (!isPublicEntry) return;

    const sync = () => setVisible(Boolean(tourLayer()));
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tourLayer()) {
        event.preventDefault();
        clickClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isPublicEntry]);

  if (!isPublicEntry) return null;

  return (
    <>
      {visible ? (
        <div className='p7-tour-patch-controls' aria-label='Управление интерактивным туром'>
          <button type='button' onClick={clickFirstStep} aria-label='Сбросить тур на первый шаг'>
            <RotateCcw size={16} />
            <span>Сбросить</span>
          </button>
          <button type='button' onClick={clickClose} aria-label='Закрыть интерактивный тур'>
            <X size={16} />
            <span>Закрыть</span>
          </button>
        </div>
      ) : null}

      <style>{`
        .p7-public-tour-layer {
          z-index: 2600 !important;
          background: linear-gradient(180deg, rgba(7,22,17,.22), rgba(7,22,17,.58)) !important;
        }
        .p7-public-tour-dialog {
          position: relative !important;
          z-index: 2601 !important;
          max-height: calc(100dvh - 18px) !important;
        }
        .p7-public-tour-topline {
          position: sticky !important;
          top: 0 !important;
          z-index: 2602 !important;
          background: rgba(246,250,245,.98) !important;
          box-shadow: 0 10px 22px rgba(7,22,17,.08) !important;
        }
        .p7-tour-patch-controls {
          position: fixed;
          left: 50%;
          top: max(10px, env(safe-area-inset-top));
          transform: translateX(-50%);
          z-index: 2700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px;
          border-radius: 18px;
          background: rgba(255,255,255,.98);
          border: 1px solid rgba(7,22,17,.10);
          box-shadow: 0 18px 44px rgba(7,22,17,.18);
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
        }
        .p7-tour-patch-controls button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 42px;
          padding: 0 13px;
          border: 0;
          border-radius: 14px;
          background: rgba(0,122,47,.08);
          color: #087a3b;
          font: 950 13px/1 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .p7-tour-patch-controls button:last-child {
          background: #087a3b;
          color: #fff;
        }
        .p7-tour-patch-controls button:focus-visible {
          outline: 3px solid rgba(0,122,47,.28);
          outline-offset: 3px;
        }
        @media (max-width: 760px) {
          .p7-public-tour-layer {
            place-items: end center !important;
            padding-top: max(58px, calc(env(safe-area-inset-top) + 54px)) !important;
          }
          .p7-public-tour-dialog {
            max-height: calc(100dvh - 72px) !important;
          }
          .p7-tour-patch-controls {
            width: min(420px, calc(100vw - 24px));
            justify-content: center;
          }
          .p7-tour-patch-controls button {
            flex: 1 1 0;
            min-width: 0;
          }
        }
      `}</style>
    </>
  );
}
