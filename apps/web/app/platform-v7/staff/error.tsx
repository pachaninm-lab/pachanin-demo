'use client';

import { useLocale } from 'next-intl';
import { getStaffCopy } from '@/i18n/staff-messages';

export default function StaffError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const copy = getStaffCopy(useLocale());
  return (
    <section className='pc-staff-state' role='alert'>
      <span aria-hidden='true'>!</span>
      <h1>{copy.unavailableTitle}</h1>
      <p>{copy.unavailableText}</p>
      <button type='button' onClick={reset}>{copy.retry}</button>
    </section>
  );
}
