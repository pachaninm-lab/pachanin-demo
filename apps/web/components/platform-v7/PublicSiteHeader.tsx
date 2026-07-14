import type { ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';
import { PublicLocaleSwitch } from '@/components/platform-v7/PublicLocaleSwitch';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

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
