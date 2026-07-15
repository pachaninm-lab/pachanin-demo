import type { ReactNode } from 'react';
import { HydrationSafeChatSupport } from '@/components/platform-v7/HydrationSafeChatSupport';
import { PublicLocaleSwitch } from '@/components/platform-v7/PublicLocaleSwitch';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

function PublicBrandMark() {
  return (
    <svg
      viewBox='0 0 40 40'
      width='40'
      height='40'
      aria-hidden='true'
      focusable='false'
      role='img'
    >
      <rect x='3' y='3' width='34' height='34' rx='10' fill='#0b5d38' />
      <path d='M11 28V14.5L20 10l9 4.5V28' fill='none' stroke='#fff' strokeWidth='2.4' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M14 25c3.7-7.4 8.3-10.1 14-10.7-1.2 6.7-5.8 11.2-14 10.7Z' fill='#9ad7aa' />
      <path d='M14 25c4.1-3.9 8.2-6.7 12.8-8.4' fill='none' stroke='#fff' strokeWidth='1.8' strokeLinecap='round' />
      <circle cx='12.2' cy='29.2' r='1.6' fill='#fff' />
      <circle cx='27.8' cy='29.2' r='1.6' fill='#fff' />
    </svg>
  );
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
          <span className='pc-site-brand-mark'><PublicBrandMark /></span>
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
