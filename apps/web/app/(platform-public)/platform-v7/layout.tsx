import type { Metadata } from 'next';
import { PublicSupportWidget } from '@/components/platform-v7/PublicSupportWidget';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://процент-агро.рф';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'Прозрачная Цена',
};

export default function PlatformPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PublicSupportWidget />
    </>
  );
}
