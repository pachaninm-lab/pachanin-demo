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
      className='group min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none'
      data-gekta-starter='true'
    >
      <span className='flex items-start justify-between gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-800'>
        {starter.label}
        <ArrowUpRight className='h-4 w-4 shrink-0' aria-hidden='true' />
      </span>
      <span className='mt-2 block text-sm leading-5 text-slate-700'>{starter.prompt}</span>
    </button>
  );
}

/**
 * Examples are a starting point, not a catalogue of what Gekta can do — the
 * capability block owns that. Choosing one drops the text into the composer so
 * the person can edit it before sending; nothing is sent behind their back.
 */
export function GektaEmptyState({ locale, hero, starters, onStarter }: {
  locale: GektaLocale;
  hero?: React.ReactNode;
  starters: readonly GektaStarter[];
  onStarter: (prompt: string) => void;
}) {
  const copy = getGektaProductCopy(locale);
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className='mx-auto flex w-full max-w-[1000px] flex-1 flex-col justify-center px-3 pb-5 sm:px-6'>
      {hero}
      <section className='mx-auto mt-10 w-full max-w-4xl' aria-labelledby='gekta-examples-title'>
        <h2 id='gekta-examples-title' className='text-base font-semibold text-slate-950'>{copy.examplesTitle}</h2>
        <p className='mt-1 text-sm text-slate-600'>{copy.examplesLead}</p>
        <div className='mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {starters.map((starter) => <StarterButton key={`${starter.label}-${starter.prompt}`} starter={starter} onStarter={onStarter} />)}
        </div>

        <button
          type='button'
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls='gekta-more-examples'
          className='mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
          data-gekta-more-examples='true'
        >
          {expanded ? copy.examplesLess : copy.examplesMore}
          <ChevronDown className={`h-4 w-4 transition motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden='true' />
        </button>

        <div id='gekta-more-examples' hidden={!expanded} className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {copy.extraStarters.map((starter) => <StarterButton key={`${starter.label}-${starter.prompt}`} starter={starter} onStarter={onStarter} />)}
        </div>
      </section>
    </div>
  );
}
