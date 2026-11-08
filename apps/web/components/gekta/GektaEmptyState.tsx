'use client';

import * as React from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import type { GektaLocale, GektaStarter } from '@/lib/gekta/content';
import { getGektaProductCopy } from '@/lib/gekta/product-copy';

function StarterButton({ starter, onStarter }: { starter: GektaStarter; onStarter: (prompt: string) => void }) {
  return (
    <button
      type='button'
      onClick={() => onStarter(starter.prompt)}
      className='group min-h-[78px] rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none sm:min-h-24 sm:p-4'
      data-gekta-starter='true'
    >
      <span className='flex items-start justify-between gap-3 text-[14px] font-semibold uppercase tracking-[0.06em] text-emerald-800'>
        {starter.label}
        <ArrowUpRight className='h-4 w-4 shrink-0' aria-hidden='true' />
      </span>
      <span className='mt-2 block text-[14px] leading-5 text-slate-700'>{starter.prompt}</span>
    </button>
  );
}

/**
 * Mobile reading order is positioning, composer, then examples. The composer
 * is mounted into this slot for the whole discovery state and does not change
 * parent when the on-screen keyboard opens or closes.
 */
export function GektaEmptyState({ locale, hero, starters, onStarter }: {
  locale: GektaLocale;
  hero?: React.ReactNode;
  starters: readonly GektaStarter[];
  onStarter: (prompt: string) => void;
}) {
  const copy = getGektaProductCopy(locale);
  const [expanded, setExpanded] = React.useState(false);
  const primaryStarters = starters.slice(0, 2);
  const moreStarters = [...starters.slice(2), ...copy.extraStarters];

  return (
    <div className='mx-auto flex w-full max-w-[1000px] flex-col px-3 pb-5 sm:px-6 sm:pb-8'>
      {hero}
      <div data-gekta-composer-slot='true' className='mt-3 w-full sm:mt-5' />
      <section className='mx-auto mt-2 w-full max-w-4xl sm:mt-4' aria-labelledby='gekta-examples-title' data-gekta-examples='true'>
        <h2 id='gekta-examples-title' className='text-base font-semibold text-slate-950'>{copy.examplesTitle}</h2>
        <p className='mt-1 text-[14px] leading-5 text-slate-600'>{copy.examplesLead}</p>
        <div className='mt-3 grid gap-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-3'>
          {primaryStarters.map((starter) => <StarterButton key={`${starter.label}-${starter.prompt}`} starter={starter} onStarter={onStarter} />)}
        </div>

        {moreStarters.length ? (
          <button
            type='button'
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls='gekta-more-examples'
            className='mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:mt-4'
            data-gekta-more-examples='true'
          >
            {expanded ? copy.examplesLess : copy.examplesMore}
            <ChevronDown className={`h-4 w-4 transition motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden='true' />
          </button>
        ) : null}

        <div id='gekta-more-examples' className={expanded ? 'mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3' : 'hidden'}>
          {moreStarters.map((starter) => <StarterButton key={`${starter.label}-${starter.prompt}`} starter={starter} onStarter={onStarter} />)}
        </div>
      </section>
    </div>
  );
}
