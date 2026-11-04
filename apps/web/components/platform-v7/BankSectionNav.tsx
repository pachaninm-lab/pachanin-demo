'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
} from '@/lib/platform-v7/routes';

type BankSectionLink = {
  href: string;
  label: string;
};

type BankSectionNavProps = {
  links: readonly BankSectionLink[];
};

const NAV_COPY = {
  ru: { navigation: 'Банковские действия', bank: 'Банковый контур', review: 'Проверка выплаты', basis: 'Основание выплаты', home: 'На главную' },
  en: { navigation: 'Bank navigation', bank: 'Bank workspace', review: 'Payout review', basis: 'Payment basis', home: 'Platform home' },
  zh: { navigation: '银行导航', bank: '银行工作区', review: '付款检查', basis: '付款依据', home: '平台首页' },
} as const;

// Presentation only: the existing server cabinet and bank guards own access.
// Unknown paths cannot opt into bank-only navigation by sharing a prefix.
const BANK_ONLY_PATHS: ReadonlySet<string> = new Set([
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  '/platform-v7/bank/grain',
]);

export function BankSectionNav({ links }: BankSectionNavProps) {
  const pathname = usePathname() ?? '';
  const locale = useLocale();
  const copy = NAV_COPY[locale.startsWith('en') ? 'en' : locale.startsWith('zh') ? 'zh' : 'ru'];
  const bankOnlyPath = BANK_ONLY_PATHS.has(pathname)
    || /^\/platform-v7\/bank\/events\/[A-Za-z0-9_-]+$/.test(pathname);
  const labels: Readonly<Record<string, string>> = {
    [PLATFORM_V7_BANK_ROUTE]: copy.bank,
    [PLATFORM_V7_RELEASE_SAFETY_ROUTE]: copy.review,
    [PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE]: copy.basis,
  };
  const visibleLinks = bankOnlyPath
    ? links.map(link => ({ ...link, label: labels[link.href] ?? link.label }))
    : [
      { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: copy.basis },
      { href: '/platform-v7', label: copy.home },
    ];
  const activeHref = visibleLinks.find(link => link.href === pathname)?.href;

  return (
    <nav aria-label={copy.navigation} className='p7-bank-section-nav'>
      {visibleLinks.map((link) => {
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
      <style dangerouslySetInnerHTML={{ __html: `
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
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          padding: 7px 12px;
          color: var(--pc-text-secondary, #5F6873);
          font-size: 14px;
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
            min-height: 44px;
            padding-inline: 10px;
          }
        }
      ` }} />
    </nav>
  );
}
