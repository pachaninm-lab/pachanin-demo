'use client';

import { useLocale } from 'next-intl';
import { getStaffCopy } from '@/i18n/staff-messages';

export default function StaffLoading() {
  const copy = getStaffCopy(useLocale());
  return (
    <section className='pc-staff-state' aria-live='polite' aria-busy='true'>
      <span aria-hidden='true'>◆</span>
      <h1>{copy.product}</h1>
      <p>{copy.loading}</p>
    </section>
  );
}
