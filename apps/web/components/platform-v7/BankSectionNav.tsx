'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type BankSectionLink = {
  href: string;
  label: string;
};

type BankSectionNavProps = {
  links: readonly BankSectionLink[];
};

export function BankSectionNav({ links }: BankSectionNavProps) {
  const pathname = usePathname() ?? '';
  const exactMatch = links.find((link) => link.href === pathname);
  const activeHref =
    exactMatch?.href ??
    links
      .filter((link) => link.href !== '/platform-v7/bank')
      .sort((left, right) => right.href.length - left.href.length)
      .find((link) => pathname.startsWith(link.href))?.href;

  return (
    <nav aria-label='Банковские действия' className='p7-bank-section-nav'>
      {links.map((link) => {
        const isActive = link.href === activeHref;

        return (
          <Link
            key={link.href}
            aria-current={isActive ? 'page' : undefined}
            className='p7-bank-section-nav__link'
            data-active={isActive ? 'true' : 'false'}
            href={link.href}
          >
            {link.label}
          </Link>
        );
      })}
      <style>{`
        .p7-bank-section-nav {
          width: fit-content;
          max-width: 100%;
          margin-left: auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 4px;
          padding: 4px;
          border: 1px solid color-mix(in srgb, var(--pc-border, #E4E6EA) 78%, transparent);
          border-radius: 18px;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--pc-bg-card, #FFFFFF) 96%, #F6F8FB), var(--pc-bg-card, #FFFFFF));
          box-shadow: 0 12px 32px rgba(15, 20, 25, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.72);
        }

        .p7-bank-section-nav__link {
          min-height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 7px 12px;
          color: var(--pc-text-secondary, #5F6873);
          font-size: 12px;
          font-weight: 850;
          letter-spacing: -0.01em;
          line-height: 1;
          text-decoration: none;
          transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          white-space: nowrap;
        }

        .p7-bank-section-nav__link:hover {
          background: color-mix(in srgb, var(--pc-bg-muted, #F3F5F8) 86%, #FFFFFF);
          color: var(--pc-text-primary, #0F1419);
        }

        .p7-bank-section-nav__link:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--pc-accent, #2457D6) 68%, #FFFFFF);
          outline-offset: 2px;
        }

        .p7-bank-section-nav__link[data-active='true'] {
          background: linear-gradient(180deg, #172033, #0F1419);
          color: #FFFFFF;
          box-shadow: 0 8px 20px rgba(15, 20, 25, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .p7-bank-section-nav__link[data-active='true']:hover {
          color: #FFFFFF;
          transform: translateY(-1px);
        }

        @media (max-width: 640px) {
          .p7-bank-section-nav {
            width: 100%;
            justify-content: stretch;
            border-radius: 16px;
          }

          .p7-bank-section-nav__link {
            flex: 1 1 132px;
            min-height: 38px;
            padding-inline: 10px;
          }
        }
      `}</style>
    </nav>
  );
}
