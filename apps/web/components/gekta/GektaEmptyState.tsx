'use client';

import type * as React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { GektaStarter } from '@/lib/gekta/content';

export function GektaEmptyState({ hero, starters, starterLabel, onStarter }: { hero?: React.ReactNode; starters: readonly GektaStarter[]; starterLabel: string; onStarter: (prompt: string) => void }) {
  return (
    <div className='mx-auto flex w-full max-w-[1000px] flex-1 flex-col justify-center px-3 pb-5 sm:px-6'>
      {hero || <div className='mx-auto max-w-2xl pt-12 text-center'><p className='text-sm font-semibold text-emerald-800'>{starterLabel}</p></div>}
      <div className='mx-auto mt-8 grid w-full max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3' aria-label={starterLabel}>
        {starters.map((starter) => <button key={`${starter.label}-${starter.prompt}`} type='button' onClick={() => onStarter(starter.prompt)} className='group min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none'><span className='flex items-start justify-between gap-3 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-800'>{starter.label}<ArrowUpRight className='h-4 w-4 shrink-0' aria-hidden='true' /></span><span className='mt-2 block text-sm leading-5 text-slate-700'>{starter.prompt}</span></button>)}
      </div>
    </div>
  );
}
