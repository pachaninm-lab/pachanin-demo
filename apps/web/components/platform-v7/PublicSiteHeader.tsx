import type { ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';
import { PublicLocaleSwitch } from '@/components/platform-v7/PublicLocaleSwitch';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

const PUBLIC_SITE_HEADER_STYLES = `
.pc-visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}
.pc-site-mobile-menu {
  position: relative;
  display: none;
  flex: 0 0 auto;
}
.pc-site-mobile-menu > summary {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  list-style: none;
  border: 1px solid rgba(7, 22, 17, 0.14);
  border-radius: 11px;
  background: #fff;
  color: #071611;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.pc-site-mobile-menu > summary::-webkit-details-marker { display: none; }
.pc-site-menu-glyph {
  width: 18px;
  display: grid;
  gap: 4px;
}
.pc-site-menu-glyph i {
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  transition: transform 140ms ease, opacity 140ms ease;
}
.pc-site-mobile-menu[open] .pc-site-menu-glyph i:first-child { transform: translateY(6px) rotate(45deg); }
.pc-site-mobile-menu[open] .pc-site-menu-glyph i:nth-child(2) { opacity: 0; }
.pc-site-mobile-menu[open] .pc-site-menu-glyph i:last-child { transform: translateY(-6px) rotate(-45deg); }
.pc-site-mobile-nav {
  position: fixed;
  top: 68px;
  right: max(12px, env(safe-area-inset-right, 0px));
  width: min(360px, calc(100vw - 24px));
  max-height: calc(100dvh - 84px);
  overflow-y: auto;
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid rgba(7, 22, 17, 0.14);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 22px 64px rgba(7, 22, 17, 0.2);
  overscroll-behavior: contain;
}
.pc-site-mobile-nav a {
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 9px;
  color: #14231d;
  font-size: 15px;
  font-weight: 760;
  text-decoration: none;
}
.pc-site-mobile-nav a:hover,
.pc-site-mobile-nav a:focus-visible {
  background: rgba(8, 122, 59, 0.075);
  color: #07572e;
}
.pc-site-header .entry-login {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0 9px;
  border-radius: 9px;
  color: #092118;
  font-size: 14px;
  font-weight: 760;
  text-decoration: none;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .pc-site-header .pc-site-nav { display: none; }
  .pc-site-mobile-menu { display: block; }
  .pc-site-brand { flex: 1 1 auto; overflow: hidden; }
  .pc-site-brand-text { overflow: hidden; }
  .pc-site-brand-text strong { display: block; overflow: hidden; text-overflow: ellipsis; }
  .pc-site-actions { margin-left: 0; }
}
@media (max-width: 720px) {
  .pc-site-mobile-nav { top: 64px; }
  .pc-site-header .pc-site-actions { gap: 4px; }
  .pc-site-header .entry-login { padding-inline: 7px; }
}
@media (max-width: 380px) {
  .pc-site-header .pc-site-brand-text strong { max-width: 100px !important; }
  .pc-site-header .pc-site-brand { gap: 8px; }
  .pc-site-header .pc-site-actions { gap: 4px; }
  .pc-site-header .pc-site-locale-switch { min-width: 44px; padding-inline: 6px; }
  .pc-site-header .entry-login { min-width: 44px; padding-inline: 5px; font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-site-menu-glyph i { transition: none; }
}
@media (forced-colors: active) {
  .pc-site-mobile-menu > summary,
  .pc-site-mobile-nav,
  .pc-site-header .entry-login { border: 2px solid ButtonText; }
}
`;

/**
 * Single canonical public header shared by every public platform-v7 surface.
 * The optional mobile menu remains server-rendered and requires no hydration.
 */
export function PublicSiteHeader({
  tagline,
  nav,
  localeControl,
  actions,
  showMobileMenu = true,
  ariaLabel = 'Шапка сайта',
  brandHomeLabel = 'Прозрачная Цена — на главную',
  navLabel = 'Разделы',
  menuLabel = 'Открыть меню',
}: {
  tagline?: string;
  nav?: ReactNode;
  localeControl?: ReactNode;
  actions: ReactNode;
  showMobileMenu?: boolean;
  ariaLabel?: string;
  brandHomeLabel?: string;
  navLabel?: string;
  menuLabel?: string;
}) {
  return (
    <>
      <style>{PUBLIC_SITE_HEADER_STYLES}</style>
      <header className='pc-site-header' aria-label={ariaLabel}>
        <a href='/platform-v7' className='pc-site-brand' aria-label={brandHomeLabel}>
          <span className='pc-site-brand-mark'><BrandMark size={40} /></span>
          <span className='pc-site-brand-text'>
            <strong>Прозрачная Цена</strong>
            {tagline ? <small>{tagline}</small> : null}
          </span>
        </a>

        {nav ? <nav className='pc-site-nav' aria-label={navLabel}>{nav}</nav> : null}

        <div className='pc-site-actions'>
          {nav && showMobileMenu ? (
            <details className='pc-site-mobile-menu'>
              <summary aria-label={menuLabel} title={menuLabel}>
                <span aria-hidden='true' className='pc-site-menu-glyph'><i /><i /><i /></span>
                <span className='pc-visually-hidden'>{menuLabel}</span>
              </summary>
              <nav className='pc-site-mobile-nav' aria-label={navLabel}>{nav}</nav>
            </details>
          ) : null}
          {localeControl ?? <PublicLocaleSwitch />}
          {actions}
        </div>
      </header>
      <HydrationSafeChatSupport />
    </>
  );
}
