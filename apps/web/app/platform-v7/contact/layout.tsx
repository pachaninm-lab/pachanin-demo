import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { ContactFixedHeader } from '@/components/platform-v7/ContactFixedHeader';

export default async function PlatformV7ContactLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <>
      <ContactFixedHeader locale={locale} />
      {children}
    </>
  );
}
