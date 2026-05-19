import type { ReactNode } from 'react';
import { BankSectionNav } from '@/components/platform-v7/BankSectionNav';
import {
  PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
} from '@/lib/platform-v7/routes';

const bankLinks = [
  { href: PLATFORM_V7_BANK_ROUTE, label: 'Банковый контур' },
  { href: PLATFORM_V7_RELEASE_SAFETY_ROUTE, label: 'Проверка выплаты' },
  { href: PLATFORM_V7_BANK_PAYMENT_BASIS_ROUTE, label: 'Передать основание банку' },
] as const;

export default function BankLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <BankSectionNav links={bankLinks} />
      {children}
    </div>
  );
}
