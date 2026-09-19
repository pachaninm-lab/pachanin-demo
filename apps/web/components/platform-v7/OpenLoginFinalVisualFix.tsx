'use client';

import { usePathname } from 'next/navigation';

export function OpenLoginFinalVisualFix() {
  const pathname = usePathname();
  const enabled = pathname === '/platform-v7/open' || pathname === '/platform-v7/login';
  if (!enabled) return null;

  return (
    <style>{`
      .pc-open-v2 {
        padding-top: calc(86px + env(safe-area-inset-top)) !important;
      }
      .pc-open-v2 .open-header {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 7000 !important;
        height: calc(74px + env(safe-area-inset-top)) !important;
        min-height: calc(74px + env(safe-area-inset-top)) !important;
        padding: calc(10px + env(safe-area-inset-top)) 74px 10px 14px !important;
        display: block !important;
        background: rgba(255,255,255,.99) !important;
        border-bottom: 1px solid rgba(7,22,17,.08) !important;
        box-shadow: 0 10px 28px rgba(7,22,17,.08) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        backdrop-filter: blur(16px) !important;
      }
      .pc-open-v2 .open-brand {
        height: 54px !important;
        width: 100% !important;
        max-width: 100% !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 10px !important;
        min-width: 0 !important;
      }
      .pc-open-v2 .open-brand svg,
      .pc-open-v2 .open-brand img {
        width: 42px !important;
        height: 42px !important;
        flex: 0 0 auto !important;
        display: block !important;
      }
      .pc-open-v2 .open-brand span {
        display: grid !important;
        gap: 2px !important;
        min-width: 0 !important;
      }
      .pc-open-v2 .open-brand strong {
        font-size: 17px !important;
        line-height: 1.05 !important;
        font-weight: 950 !important;
        letter-spacing: -.045em !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .pc-open-v2 .open-brand small {
        font-size: 10px !important;
        line-height: 1.1 !important;
        font-weight: 850 !important;
        color: #68756f !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .pc-open-v2 .open-back {
        position: absolute !important;
        right: 14px !important;
        top: calc(10px + env(safe-area-inset-top)) !important;
        left: auto !important;
        bottom: auto !important;
        transform: none !important;
        width: 52px !important;
        min-width: 52px !important;
        height: 52px !important;
        min-height: 52px !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 18px !important;
        border: 1px solid rgba(7,22,17,.10) !important;
        background: #fff !important;
        box-shadow: 0 8px 20px rgba(7,22,17,.06) !important;
        color: #06150f !important;
        z-index: 2 !important;
      }
      .pc-open-v2 .open-card {
        margin-top: 0 !important;
      }
      @media (max-width: 720px) {
        .pc-open-v2 {
          padding-top: calc(84px + env(safe-area-inset-top)) !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }
        .pc-open-v2 .open-header {
          height: calc(72px + env(safe-area-inset-top)) !important;
          min-height: calc(72px + env(safe-area-inset-top)) !important;
          padding: calc(9px + env(safe-area-inset-top)) 68px 9px 10px !important;
        }
        .pc-open-v2 .open-back {
          right: 10px !important;
          top: calc(10px + env(safe-area-inset-top)) !important;
          width: 50px !important;
          min-width: 50px !important;
          height: 50px !important;
          min-height: 50px !important;
          border-radius: 17px !important;
        }
        .pc-open-v2 .open-brand svg,
        .pc-open-v2 .open-brand img {
          width: 42px !important;
          height: 42px !important;
        }
      }
    `}</style>
  );
}
