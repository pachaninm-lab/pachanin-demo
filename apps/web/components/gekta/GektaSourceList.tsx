'use client';

import * as React from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { GektaCitation } from './GektaChatTypes';
import { OutboundLink, DEFAULT_OUTBOUND_COPY, type OutboundLinkCopy } from '@/components/common/OutboundLink';
import { outboundDestination } from '@/lib/gekta/outbound-destination';

/**
 * ASVS V3.7.3. A citation is a destination the assistant chose, not one this
 * application vouches for, so leaving for it is a step the person takes rather
 * than one a click performs. The notice names the host and the navigation only
 * happens if they confirm it.
 */

export function GektaSourceList({ citations, label, onOpen, outboundCopy = DEFAULT_OUTBOUND_COPY }: { citations: readonly GektaCitation[]; label: string; onOpen?: () => void; outboundCopy?: OutboundLinkCopy }) {
  const pageOrigin = typeof window === 'undefined' ? 'https://localhost' : window.location.origin;
  const clean = citations.flatMap((citation) => {
    const destination = outboundDestination(citation.uri, pageOrigin);
    return destination ? [{ ...citation, destination }] : [];
  });
  if (!clean.length) return null;
  return (
    <details className='mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3'>
      <summary className='flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-800 marker:hidden'>{label} <span className='rounded-full bg-white px-2 py-0.5 text-xs text-slate-500'>{clean.length}</span><ChevronDown className='ml-auto h-4 w-4 text-slate-500' aria-hidden='true' /></summary>
      <div className='mt-3 space-y-2'>
        {clean.map((citation) => (
          <OutboundLink
            key={`${citation.sourceId}-${citation.uri}`}
            uri={citation.uri}
            newTab
            copy={outboundCopy}
            onOpen={onOpen}
            className='flex min-h-11 min-w-0 items-start gap-3 rounded-xl bg-white p-3 text-sm hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
          >
            <ExternalLink className='mt-0.5 h-4 w-4 shrink-0 text-emerald-700' aria-hidden='true' />
            <span className='min-w-0'><strong className='block truncate text-slate-900'>{citation.title || citation.destination.host}</strong><span className='mt-0.5 block break-all text-xs text-slate-500'>{citation.destination.host}</span></span>
          </OutboundLink>
        ))}
      </div>
    </details>
  );
}
