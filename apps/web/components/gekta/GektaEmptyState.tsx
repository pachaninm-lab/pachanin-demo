'use client';

import * as React from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown, History } from 'lucide-react';
import type { GektaLocale, GektaStarter } from '@/lib/gekta/content';
import { getGektaProductCopy } from '@/lib/gekta/product-copy';
import styles from './GektaWorkspace.module.css';

const RESUME_LABEL = {
  ru: 'Продолжить последний диалог',
  en: 'Continue last conversation',
  zh: '继续上次对话',
} satisfies Record<GektaLocale, string>;

function StarterButton({ starter, onStarter }: { starter: GektaStarter; onStarter: (prompt: string) => void }) {
  return (
    <button
      type='button'
      onClick={() => onStarter(starter.prompt)}
      className={`${styles.starter} min-h-[78px] rounded-2xl border p-3.5 text-left sm:min-h-24 sm:p-4`}
      data-gekta-starter='true'
    >
      <span className='flex items-start justify-between gap-3 text-[14px] font-semibold text-emerald-800'>
        {starter.label}
        <ArrowUpRight className='h-4 w-4 shrink-0' aria-hidden='true' />
      </span>
      <span className='mt-1.5 block text-[14px] leading-5 text-slate-700'>{starter.prompt}</span>
    </button>
  );
}

/**
 * Render the composer between the introduction and examples from the first
 * server response so it keeps its place when the interface becomes interactive.
 */
export function GektaEmptyState({ locale, hero, accessGate, composer, showStarters, starters, onStarter, resume }: {
  locale: GektaLocale;
  hero?: React.ReactNode;
  accessGate?: React.ReactNode;
  composer?: React.ReactNode;
  showStarters: boolean;
  starters: readonly GektaStarter[];
  onStarter: (prompt: string) => void;
  resume?: { title: string; onSelect: () => void };
}) {
  const copy = getGektaProductCopy(locale);
  const [expanded, setExpanded] = React.useState(false);
  const primaryStarters = starters.slice(0, 2);
  const moreStarters = [...starters.slice(2), ...copy.extraStarters];

  return (
    <div className={`${styles.welcome} flex flex-col`}>
      {accessGate ? null : hero}
      <div data-gekta-composer-slot='true' className={accessGate ? 'w-full' : hero ? 'mt-4 w-full sm:mt-6' : 'hidden'}>{accessGate ?? composer}</div>
      {resume ? (
        <button type='button' onClick={resume.onSelect}
          className={`${styles.starter} mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left lg:hidden`}>
          <History className='h-[18px] w-[18px] shrink-0' aria-hidden='true' />
          <span className='min-w-0 flex-1'>
            <span className='block text-sm font-semibold'>{RESUME_LABEL[locale]}</span>
            <span className='block truncate text-[13px] text-slate-600'>{resume.title}</span>
          </span>
          <ArrowRight className='h-4 w-4 shrink-0' aria-hidden='true' />
        </button>
      ) : null}
      {showStarters ? <section className='mx-auto mt-3 w-full sm:mt-5' aria-labelledby='gekta-examples-title' aria-describedby='gekta-examples-description' data-gekta-examples='true'>
        <h2 id='gekta-examples-title' className='text-sm font-semibold text-slate-950'>{copy.examplesTitle}</h2>
        <p id='gekta-examples-description' className='sr-only'>{copy.examplesLead}</p>
        <div className='mt-2.5 grid gap-2.5 sm:grid-cols-2 sm:gap-3'>
          {primaryStarters.map((starter) => <StarterButton key={`${starter.label}-${starter.prompt}`} starter={starter} onStarter={onStarter} />)}
        </div>

        {moreStarters.length ? (
          <button
            type='button'
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls='gekta-more-examples'
            className='mt-2 inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-xl px-2 text-[14px] font-semibold text-emerald-800 hover:bg-slate-100'
            data-gekta-more-examples='true'
          >
            {expanded ? copy.examplesLess : copy.examplesMore}
            <ChevronDown className={`h-4 w-4 transition motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden='true' />
          </button>
        ) : null}

        <div id='gekta-more-examples' className={expanded ? 'mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3' : 'hidden'}>
          {moreStarters.map((starter) => <StarterButton key={`${starter.label}-${starter.prompt}`} starter={starter} onStarter={onStarter} />)}
        </div>
      </section> : null}
    </div>
  );
}
