import '@/styles/platform-v7-canonical-public-v1.css';
import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';
import { ContactFixedHeader } from '@/components/platform-v7/ContactFixedHeader';
import { CanonicalBottomNav, canonicalPublicLocale } from '@/components/platform-v7/PublicCanonicalPrimitives';

export default async function PlatformV7ContactLayout({ children }: { children: ReactNode }) {
  const locale = canonicalPublicLocale(await getLocale());
  return (
    <>
      <ContactFixedHeader locale={locale} />
      {children}
      <CanonicalBottomNav locale={locale} />
    </>
  );
}
