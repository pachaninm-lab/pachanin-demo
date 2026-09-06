import { Children, isValidElement, type ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';
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
.pc-site-header {
  --pc-site-control-height: 44px;
  --pc-site-control-radius: 11px;
  --pc-site-control-border: #c6d5cb;
  --pc-site-control-background: #ffffff;
  --pc-site-control-background-hover: #f2f7f4;
  --pc-site-control-color: #092118;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2600;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
  padding: 0 clamp(16px, 4vw, 44px);
  background: rgba(255, 255, 255, 0.97);
  border-bottom: 1px solid rgba(7, 22, 17, 0.08);
  box-shadow: 0 8px 24px rgba(7, 22, 17, 0.06);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
/* Canonical public-header authority. The repeated class+attribute specificity is
 * deliberate: older linked pages still carry route-local header overrides.
 * This contract wins without changing protected/personal-cabinet chrome. */
.pc-site-header[data-public-site-header='canonical'].pc-site-header {
  --pc-public-header-base-height: 64px;
  --pc-public-header-total-height: calc(64px + env(safe-area-inset-top, 0px));
  display: flex !important;
  flex-wrap: nowrap !important;
  align-content: center !important;
  align-items: center !important;
  height: 64px !important;
  min-height: 64px !important;
  max-height: 64px !important;
  gap: 10px !important;
  padding-inline: clamp(12px, 3vw, 32px) !important;
}
.pc-site-brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  color: #071611;
  text-decoration: none;
  flex: 0 0 auto;
}
.pc-site-brand-mark {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  overflow: hidden;
  flex: 0 0 40px;
}
.pc-site-brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.pc-site-brand-text {
  display: grid;
  min-width: 0;
}
.pc-site-brand-text strong {
  font-size: 18px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -0.03em;
  white-space: nowrap;
}
.pc-site-brand-text small {
  margin-top: 2px;
  color: #66736e;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.05;
  white-space: nowrap;
}
.pc-site-nav {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  min-width: 0;
  color: #17251f;
  font-size: 14px;
  font-weight: 760;
}
.pc-site-nav a {
  color: inherit;
  text-decoration: none;
  white-space: nowrap;
}
.pc-site-nav a:hover { color: #087a3b; }
.pc-site-actions {
  flex: 0 0 auto;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  min-width: 0;
}
.pc-site-actions > div {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pc-site-brand-mark[data-brand-mark='transparent-price-canonical'] {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: inline-grid;
  place-items: center;
  overflow: visible;
  background: transparent;
}
.pc-site-brand-mark[data-brand-mark='transparent-price-canonical'] > span,
.pc-site-brand-mark[data-brand-mark='transparent-price-canonical'] img {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
  object-fit: contain !important;
  background: transparent !important;
}
.pc-site-mobile-menu {
  position: relative;
  display: none;
  flex: 0 0 auto;
}
.pc-site-mobile-menu > summary,
.pc-site-header .pc-site-locale-switch,
.pc-site-header .entry-login,
.pc-site-header .pc-site-action {
  box-sizing: border-box;
  min-height: var(--pc-site-control-height);
  height: var(--pc-site-control-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1px solid var(--pc-site-control-border);
  border-radius: var(--pc-site-control-radius);
  background: var(--pc-site-control-background);
  color: var(--pc-site-control-color);
  box-shadow: none;
  text-decoration: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.pc-site-header :is(.pc-v6-header-cta, .pc-ppe-primary-button, .p7-about-register, .p7-contact-register) {
  box-sizing: border-box;
  width: auto !important;
  min-width: 0 !important;
  height: var(--pc-site-control-height) !important;
  min-height: var(--pc-site-control-height) !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  padding: 0 14px !important;
  border: 1px solid #087a3b !important;
  border-radius: var(--pc-site-control-radius) !important;
  background: #087a3b !important;
  color: #fff !important;
  font-size: 14px !important;
  font-weight: 800 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  text-decoration: none !important;
}
.pc-site-header :is(.pc-v6-header-cta, .pc-ppe-primary-button, .p7-about-register, .p7-contact-register):hover,
.pc-site-header :is(.pc-v6-header-cta, .pc-ppe-primary-button, .p7-about-register, .p7-contact-register):focus-visible {
  background: #07572e !important;
  border-color: #07572e !important;
  color: #fff !important;
}
.pc-site-mobile-menu > summary {
  width: var(--pc-site-control-height);
  padding: 0;
  list-style: none;
  cursor: pointer;
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
.pc-site-header .pc-site-locale-switch {
  min-width: 58px;
  gap: 6px;
  padding: 0 11px;
  font: inherit;
  font-size: 14px;
  font-weight: 760;
  cursor: pointer;
}
.pc-site-header .pc-site-locale-switch span {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.025em;
}
.pc-site-header .entry-login {
  padding: 0 12px;
  font-size: 14px;
  font-weight: 760;
  white-space: nowrap;
}
.pc-site-header .pc-site-action {
  width: var(--pc-site-control-height);
  padding: 0;
}
.pc-site-mobile-menu > summary:hover,
.pc-site-mobile-menu > summary:focus-visible,
.pc-site-header .pc-site-locale-switch:hover,
.pc-site-header .pc-site-locale-switch:focus-visible,
.pc-site-header .entry-login:hover,
.pc-site-header .entry-login:focus-visible,
.pc-site-header .pc-site-action:hover,
.pc-site-header .pc-site-action:focus-visible {
  border-color: #8eaa98;
  background: var(--pc-site-control-background-hover);
  color: #07572e;
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
  .pc-site-header[data-public-site-header='canonical'].pc-site-header {
    gap: 5px !important;
    padding-inline: 8px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .pc-site-brand-text {
    display: none !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .pc-site-brand {
    flex: 1 1 auto !important;
    min-width: 36px !important;
    overflow: visible !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .pc-site-actions,
  .pc-site-header[data-public-site-header='canonical'] .pc-site-actions > div {
    gap: 4px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .pc-site-brand-mark[data-brand-mark='transparent-price-canonical'] {
    width: 36px !important;
    height: 36px !important;
    flex-basis: 36px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .pc-site-mobile-menu > summary {
    width: 44px !important;
    min-width: 44px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .pc-site-locale-switch {
    min-width: 44px !important;
    width: 44px !important;
    padding-inline: 5px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .entry-login {
    min-width: 50px !important;
    padding-inline: 7px !important;
    font-size: 12px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] :is(.pc-v6-header-cta, .pc-ppe-primary-button, .p7-about-register, .p7-contact-register) {
    max-width: 116px !important;
    padding-inline: 9px !important;
    font-size: 12px !important;
  }
  .pc-site-mobile-nav { top: 68px; }
  .pc-v7-public-entry:has(.pc-site-header[data-public-site-header='canonical']) {
    --entry-public-header-base: 64px !important;
    --pc-public-header-base-height: 64px !important;
    --pc-public-header-total-height: calc(64px + var(--entry-public-header-offset, 0px)) !important;
    --entry-header-height: calc(64px + var(--entry-public-header-offset, 0px)) !important;
  }
}
@media (max-width: 380px) {
  .pc-site-header[data-public-site-header='canonical'] .pc-site-locale-switch {
    min-width: 42px !important;
    width: 42px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] .entry-login {
    min-width: 46px !important;
    padding-inline: 5px !important;
    font-size: 11px !important;
  }
  .pc-site-header[data-public-site-header='canonical'] :is(.pc-v6-header-cta, .pc-ppe-primary-button, .p7-about-register, .p7-contact-register) {
    max-width: 98px !important;
    padding-inline: 7px !important;
    font-size: 11px !important;
  }
}
@media (max-width: 340px) {
  .pc-site-header[data-public-site-header='canonical'].pc-site-header { padding-inline: 6px !important; }
  .pc-site-header[data-public-site-header='canonical'] .entry-login { min-width: 44px !important; }
  .pc-site-header[data-public-site-header='canonical'] :is(.pc-v6-header-cta, .pc-ppe-primary-button, .p7-about-register, .p7-contact-register) {
    max-width: 88px !important;
    padding-inline: 6px !important;
    font-size: 10.5px !important;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pc-site-menu-glyph i { transition: none; }
}
@media (forced-colors: active) {
  .pc-site-mobile-menu > summary,
  .pc-site-mobile-nav,
  .pc-site-header .pc-site-locale-switch,
  .pc-site-header .entry-login,
  .pc-site-header .pc-site-action { border: 2px solid ButtonText; }
}
`;

type PublicLocale = 'ru' | 'en' | 'zh';

function findActionLocale(node: ReactNode): PublicLocale | null {
  const queue = [...Children.toArray(node)];
  while (queue.length > 0) {
    const child = queue.shift();
    if (!isValidElement<{ href?: unknown; children?: ReactNode }>(child)) continue;
    const href = child.props.href;
    if (typeof href === 'string' && href.startsWith('/platform-v7')) {
      const match = href.match(/[?&]lang=(ru|en|zh)(?:&|#|$)/);
      if (match?.[1] === 'ru' || match?.[1] === 'en' || match?.[1] === 'zh') return match[1];
    }
    queue.push(...Children.toArray(child.props.children));
  }
  return null;
}

function resolveBrandHomeHref(actions: ReactNode, explicitHref?: string) {
  if (explicitHref) return explicitHref;
  const locale = findActionLocale(actions);
  return locale ? `/platform-v7?lang=${locale}` : '/platform-v7';
}

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
  brandHomeHref,
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
  brandHomeHref?: string;
  navLabel?: string;
  menuLabel?: string;
}) {
  const resolvedBrandHomeHref = resolveBrandHomeHref(actions, brandHomeHref);
  return (
    <>
      <style>{PUBLIC_SITE_HEADER_STYLES}</style>
      <header className='pc-site-header' data-public-site-header='canonical' aria-label={ariaLabel}>
        <a href={resolvedBrandHomeHref} className='pc-site-brand' aria-label={brandHomeLabel}>
          <span className='pc-site-brand-mark' data-brand-mark='transparent-price-canonical'><BrandMark size={40} /></span>
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
    </>
  );
}
