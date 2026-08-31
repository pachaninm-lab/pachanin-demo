'use client';

import * as React from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { GektaCitation } from './GektaChatTypes';

function safeSource(uri: string): URL | null {
  try {
    const url = new URL(uri);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function GektaSourceList({ citations, label, onOpen }: { citations: readonly GektaCitation[]; label: string; onOpen?: () => void }) {
  const clean = citations.flatMap((citation) => {
    const url = safeSource(citation.uri);
    return url ? [{ ...citation, url }] : [];
  });
  if (!clean.length) return null;
  return (
    <details className='mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-800 marker:hidden'>{label} <span className='rounded-full bg-white px-2 py-0.5 text-xs text-slate-500'>{clean.length}</span><ChevronDown className='ml-auto h-4 w-4 text-slate-500' aria-hidden='true' /></summary>
      <div className='mt-3 space-y-2'>
        {clean.map((citation) => (
          <a key={`${citation.sourceId}-${citation.uri}`} href={citation.url.toString()} target='_blank' rel='noreferrer' onClick={onOpen} className='flex min-h-11 min-w-0 items-start gap-3 rounded-xl bg-white p-3 text-sm hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
            <ExternalLink className='mt-0.5 h-4 w-4 shrink-0 text-emerald-700' aria-hidden='true' />
            <span className='min-w-0'><strong className='block truncate text-slate-900'>{citation.title || citation.url.hostname}</strong><span className='mt-0.5 block break-all text-xs text-slate-500'>{citation.url.hostname}</span></span>
          </a>
        ))}
      </div>
    </details>
  );
}
