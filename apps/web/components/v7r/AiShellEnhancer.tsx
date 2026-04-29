'use client';

import { PlatformV7NotificationCenter } from '@/components/v7r/PlatformV7NotificationCenter';

export function AiShellEnhancer() {
  return (
    <>
      <style>{`
        .pc-header-brand > span:first-child,
        .app-header-brand > span:first-child,
        .pc-brand-mark-fallback {
          background-image: none !important;
        }

        .pc-header-brand > span:first-child img,
        .app-header-brand > span:first-child img,
        .pc-brand-mark-fallback img,
        img[src='/apple-icon'],
        img[src^='/apple-icon?'] {
          opacity: 1 !important;
          visibility: visible !important;
          display: block !important;
        }

        .pc-role-banner,
        .pc-giga,
        [data-pc-ai-panel='legacy'],
        #pc-ai-dock,
        .sticky-action,
        .pc-main .pc-giga,
        .pc-main [class*='giga'],
        .pc-main [class*='sticky-action'] {
          display: none !important;
        }

        .pc-header-actions button[aria-label^='Уведомления:']:not([aria-label*='непрочитанных']) {
          display: none !important;
        }

        .pc-notification-center-bridge {
          position: fixed;
          top: calc(env(safe-area-inset-top) + 88px);
          right: 16px;
          z-index: 132;
        }

        .pc-shell-root {
          --pc-header-offset: 136px !important;
        }

        .pc-main {
          padding-top: calc(var(--pc-header-offset) + 8px) !important;
        }

        @media (max-width: 768px) {
          .pc-shell-root {
            --pc-header-offset: 136px !important;
          }

          .pc-notification-center-bridge {
            top: calc(env(safe-area-inset-top) + 82px);
            right: 12px;
          }
        }

        @media (max-width: 560px) {
          .pc-shell-root {
            --pc-header-offset: 132px !important;
          }

          .pc-notification-center-bridge {
            top: calc(env(safe-area-inset-top) + 78px);
            right: 10px;
          }
        }
      `}</style>
      <div className='pc-notification-center-bridge' aria-label='Центр уведомлений platform-v7 shell'>
        <PlatformV7NotificationCenter />
      </div>
    </>
  );
}
