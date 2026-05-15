'use client';

import * as React from 'react';

export function PlatformV7VisualReset() {
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem('pc-theme');
    const storedVersion = window.localStorage.getItem('pc-theme-version');
    const currentVersion = 'light-default-2026-05-15-visual-reset';

    if (storedTheme !== 'dark' || storedVersion !== currentVersion) {
      root.setAttribute('data-theme', 'light');
      document.body?.setAttribute('data-theme', 'light');
      window.localStorage.setItem('pc-theme', 'light');
      window.localStorage.setItem('pc-theme-version', currentVersion);
    }
  }, []);

  return (
    <style>{`
      html[data-theme='light'] .pc-shell-root-v4,
      html[data-theme='light'] body[data-theme='light'] {
        color-scheme: light;
      }

      html[data-theme='light'] .pc-shell-root-v4 {
        --pc-bg: #f6f3ec;
        --pc-bg-card: rgba(255, 255, 255, 0.94);
        --pc-bg-elevated: #ffffff;
        --pc-bg-subtle: #f0ece3;
        --pc-bg-header: rgba(255, 255, 255, 0.88);
        --pc-text-primary: #151922;
        --pc-text-secondary: #3f4652;
        --pc-text-muted: #747b87;
        --pc-border: rgba(24, 31, 43, 0.09);
        --pc-border-light: rgba(24, 31, 43, 0.13);
        --pc-accent: #0b6f58;
        --pc-accent-strong: #12352d;
        --pc-accent-bg: rgba(11, 111, 88, 0.08);
        --pc-accent-border: rgba(11, 111, 88, 0.17);
        --pc-warning: #a15c12;
        --pc-danger: #a83636;
        --pc-success: #087a51;
        --pc-info: #255f9f;
        --pc-shadow-sm: 0 1px 2px rgba(21, 25, 34, 0.04), 0 10px 32px rgba(21, 25, 34, 0.06);
        --pc-shadow-md: 0 18px 60px rgba(21, 25, 34, 0.08);
        --pc-shadow-lg: 0 28px 90px rgba(21, 25, 34, 0.14);
        background:
          radial-gradient(circle at 18% -8%, rgba(11, 111, 88, 0.10), transparent 34rem),
          radial-gradient(circle at 92% 2%, rgba(161, 92, 18, 0.08), transparent 30rem),
          linear-gradient(180deg, #f8f5ef 0%, #f1eee7 54%, #f8f5ef 100%) !important;
      }

      html[data-theme='light'] .pc-v4-header {
        background: rgba(255, 255, 255, 0.86) !important;
        border-bottom: 1px solid rgba(24, 31, 43, 0.08) !important;
        box-shadow: 0 10px 36px rgba(21, 25, 34, 0.06) !important;
      }

      html[data-theme='light'] .pc-v4-header-inner {
        padding-top: calc(env(safe-area-inset-top) + 8px) !important;
        padding-bottom: 8px !important;
        gap: 8px !important;
      }

      html[data-theme='light'] .pc-v4-top {
        gap: 10px !important;
      }

      html[data-theme='light'] .pc-v4-iconbtn,
      html[data-theme='light'] .pc-v4-search,
      html[data-theme='light'] .pc-v4-select,
      html[data-theme='light'] .pc-v4-mobile-role,
      html[data-theme='light'] .pc-v4-stage,
      html[data-theme='light'] .pc-v4-status,
      html[data-theme='light'] .pc-v4-pilot-note,
      html[data-theme='light'] .pc-v4-drawer,
      html[data-theme='light'] .pc-v4-nav-item,
      html[data-theme='light'] .pc-v4-alert-panel,
      html[data-theme='light'] .pc-v4-notification {
        box-shadow: none !important;
      }

      html[data-theme='light'] .pc-v4-iconbtn,
      html[data-theme='light'] .pc-v4-search,
      html[data-theme='light'] .pc-v4-select,
      html[data-theme='light'] .pc-v4-mobile-role {
        background: rgba(255, 255, 255, 0.92) !important;
        border-color: rgba(24, 31, 43, 0.09) !important;
        color: #151922 !important;
      }

      html[data-theme='light'] .pc-v4-title {
        color: #151922 !important;
        letter-spacing: -0.02em;
      }

      html[data-theme='light'] .pc-v4-subtitle,
      html[data-theme='light'] .pc-v4-crumbs,
      html[data-theme='light'] .pc-v4-statuses {
        color: #747b87 !important;
      }

      html[data-theme='light'] .pc-v4-main {
        max-width: 1320px !important;
        padding-top: calc(var(--pc-header-offset) + 14px) !important;
      }

      html[data-theme='light'] .pc-v4-pilot-note {
        display: none !important;
      }

      html[data-theme='light'] .pc-v4-stage {
        background: rgba(11, 111, 88, 0.07) !important;
        border-color: rgba(11, 111, 88, 0.15) !important;
        color: #0b6f58 !important;
      }

      html[data-theme='light'] .pc-v4-status {
        background: rgba(255, 255, 255, 0.70) !important;
        border-color: rgba(24, 31, 43, 0.08) !important;
        color: #4f5662 !important;
      }

      html[data-theme='light'] .pc-v4-drawer {
        background: rgba(255, 255, 255, 0.98) !important;
        border-right-color: rgba(24, 31, 43, 0.08) !important;
      }

      html[data-theme='light'] .pc-v4-nav-item {
        border-radius: 14px !important;
      }

      html[data-theme='light'] .pc-v4-nav-item[data-active='true'] {
        background: rgba(11, 111, 88, 0.08) !important;
        border-color: rgba(11, 111, 88, 0.16) !important;
      }

      html[data-theme='light'] [class*='surface'],
      html[data-theme='light'] [class*='card'],
      html[data-theme='light'] [class*='Card'],
      html[data-theme='light'] [class*='panel'],
      html[data-theme='light'] [class*='Panel'] {
        border-color: rgba(24, 31, 43, 0.09);
      }

      html[data-theme='light'] main h1,
      html[data-theme='light'] main h2,
      html[data-theme='light'] main h3 {
        letter-spacing: -0.045em;
      }

      html[data-theme='light'] main h1 {
        font-size: clamp(32px, 5.2vw, 64px);
        line-height: 0.95;
      }

      html[data-theme='light'] main p {
        color: #3f4652;
      }

      @media (max-width: 980px) {
        html[data-theme='light'] .pc-v4-search,
        html[data-theme='light'] .pc-v4-iconbtn,
        html[data-theme='light'] .pc-v4-mobile-role {
          min-width: 40px !important;
          min-height: 40px !important;
          border-radius: 12px !important;
        }

        html[data-theme='light'] .pc-v4-mobile-role {
          max-width: 112px !important;
        }
      }

      @media (max-width: 640px) {
        html[data-theme='light'] .pc-shell-root-v4 {
          --pc-header-offset: 106px !important;
        }

        html[data-theme='light'] .pc-v4-header-inner {
          padding-left: 8px !important;
          padding-right: 8px !important;
        }

        html[data-theme='light'] .pc-v4-main {
          padding-left: 8px !important;
          padding-right: 8px !important;
          padding-top: calc(var(--pc-header-offset) + 10px) !important;
        }
      }
    `}</style>
  );
}
