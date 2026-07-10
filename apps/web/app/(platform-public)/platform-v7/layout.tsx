import type { Metadata } from 'next';
import { PublicSupportWidget } from '@/components/platform-v7/PublicSupportWidget';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://xn----8sbnqchpeeeth.xn--p1ai'),
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
