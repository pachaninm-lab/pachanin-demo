import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { StaffViewAsClient } from '@/components/platform-v7/staff/StaffViewAsClient';
import { getStaffCopy } from '@/i18n/staff-messages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const copy = getStaffCopy(await getLocale());
  return {
    title: `${copy.viewAsTitle} — ${copy.brand}`,
    robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  };
}

export default async function StaffViewAsPage() {
  const copy = getStaffCopy(await getLocale());
  return <StaffViewAsClient copy={copy} />;
}
