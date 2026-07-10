import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

/**
 * Single canonical public header shared by every public platform-v7 surface.
 * The caller supplies the locale control so server-rendered pages do not need
 * a client-side i18n boundary solely for language navigation.
 */
export function PublicSiteHeader({
  tagline,
  nav,
  localeControl,
  actions,
  ariaLabel = 'Шапка сайта',
}: {
  tagline?: string;
  nav?: ReactNode;
  localeControl: ReactNode;
  actions: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <header className='pc-site-header' aria-label={ariaLabel}>
      <Link prefetch={false} href='/platform-v7' className='pc-site-brand' aria-label='Прозрачная Цена — на главную'>
        <span className='pc-site-brand-mark'><BrandMark size={40} /></span>
        <span className='pc-site-brand-text'>
          <strong>Прозрачная Цена</strong>
          {tagline ? <small>{tagline}</small> : null}
        </span>
      </Link>
      {nav ? <nav className='pc-site-nav' aria-label='Разделы'>{nav}</nav> : null}
      <div className='pc-site-actions'>
        {localeControl}
        {actions}
      </div>
    </header>
  );
}
