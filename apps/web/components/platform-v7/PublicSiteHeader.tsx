import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { PublicLocaleSwitch } from '@/components/platform-v7/PublicLocaleSwitch';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

/**
 * Single canonical public header shared by every public platform-v7 surface.
 * Locale switching is rendered inside the header and triggers a server-side
 * next-intl render; it does not mutate translated text in the DOM.
 */
export function PublicSiteHeader({
  tagline,
  nav,
  actions,
  ariaLabel = 'Шапка сайта',
}: {
  tagline?: string;
  nav?: ReactNode;
  actions: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <header className='pc-site-header' aria-label={ariaLabel}>
      <Link href='/platform-v7' className='pc-site-brand' aria-label='Прозрачная Цена — на главную'>
        <span className='pc-site-brand-mark'><BrandMark size={40} /></span>
        <span className='pc-site-brand-text'>
          <strong>Прозрачная Цена</strong>
          {tagline ? <small>{tagline}</small> : null}
        </span>
      </Link>
      {nav ? <nav className='pc-site-nav' aria-label='Разделы'>{nav}</nav> : null}
      <div className='pc-site-actions'>
        <PublicLocaleSwitch />
        {actions}
      </div>
    </header>
  );
}
