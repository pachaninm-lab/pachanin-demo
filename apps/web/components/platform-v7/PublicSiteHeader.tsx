import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandMark } from '@/components/v7r/BrandMark';
import { PublicLocaleSwitcher } from '@/components/platform-v7/PublicLocaleSwitcher';
import styles from './PublicSiteHeader.module.css';

export const PUBLIC_SITE_HEADER_HEIGHT = 64;

export function PublicSiteHeader({
  brand = 'Прозрачная Цена',
  tagline,
  nav,
  actions,
  ariaLabel = 'Шапка сайта',
  homeAriaLabel = 'Прозрачная Цена — на главную',
  sectionsAriaLabel = 'Разделы',
}: {
  brand?: string;
  tagline?: string;
  nav?: ReactNode;
  actions?: ReactNode;
  ariaLabel?: string;
  homeAriaLabel?: string;
  sectionsAriaLabel?: string;
}) {
  return (
    <header className={styles.header} aria-label={ariaLabel}>
      <Link href='/platform-v7' className={styles.brand} aria-label={homeAriaLabel}>
        <span className={styles.brandMark}><BrandMark size={40} /></span>
        <span className={styles.brandText}>
          <strong>{brand}</strong>
          {tagline ? <small>{tagline}</small> : null}
        </span>
      </Link>
      {nav ? <nav className={styles.nav} aria-label={sectionsAriaLabel}>{nav}</nav> : null}
      <div className={styles.actions}>
        <PublicLocaleSwitcher />
        {actions}
      </div>
    </header>
  );
}
