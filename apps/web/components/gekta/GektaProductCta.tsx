'use client';

import Link from 'next/link';
import { ArrowRight, MessageSquareText } from 'lucide-react';
import { getGektaProductCopy } from '@/lib/gekta/product-copy';
import type { GektaLocale } from '@/lib/gekta/content';

export const GEKTA_ENTER_CHAT_EVENT = 'gekta:enter-chat';

/**
 * The two product actions, deliberately unequal: talking to Gekta is the primary
 * action on Gekta's own page, and the platform is the quieter secondary exit.
 */
export function GektaProductCta({ locale, variant = 'section' }: { locale: GektaLocale; variant?: 'hero' | 'section' }) {
  const copy = getGektaProductCopy(locale);
  const hero = variant === 'hero';

  return (
    <div className={hero ? 'mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center' : 'mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'}>
      <button
        type='button'
        onClick={() => window.dispatchEvent(new CustomEvent(GEKTA_ENTER_CHAT_EVENT, { detail: { source: variant } }))}
        className='inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-800 px-6 text-base font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
        data-gekta-primary-cta='true'
      >
        <MessageSquareText className='h-4 w-4' aria-hidden='true' />
        {copy.ctaPrimary}
      </button>
      <Link
        href='/platform-v7'
        className='inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-transparent px-5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
        data-gekta-secondary-cta='true'
      >
        {copy.ctaSecondary}
        <ArrowRight className='h-4 w-4' aria-hidden='true' />
      </Link>
    </div>
  );
}
