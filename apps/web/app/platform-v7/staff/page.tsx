import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { StaffControlCenterClient } from '@/components/platform-v7/staff/StaffControlCenterClient';
import { getStaffCopy } from '@/i18n/staff-messages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getStaffCopy(locale);
  return {
    title: copy.metadataTitle,
    description: copy.metadataDescription,
    robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  };
}

export default async function StaffControlCenterPage() {
  const locale = await getLocale();
  const copy = getStaffCopy(locale);

  return (
    <>
      <a className='pc-staff-skip' href='#staff-workspace'>{copy.skip}</a>
      <StaffControlCenterClient copy={copy} />
    </>
  );
}
