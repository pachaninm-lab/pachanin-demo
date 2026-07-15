'use client';

import { useEffect, useState } from 'react';
import { PublicDealExplorer } from '@/components/platform-v7/PublicDealExplorer';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import type { PublicProductEntryVariantsCopy } from '@/i18n/public-product-entry-variants';
import {
  normalizeTourEntryVariant,
  normalizeTourStateFromSearchParams,
  writeTourStateToSearchParams,
  type TourEntryVariant,
  type TourState,
} from '@/lib/platform-v7/public-product-experience-state';

function viewportGroup() {
  if (typeof window === 'undefined') return 'server';
  if (window.innerWidth < 720) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
}

function emit(locale: string, variant: Exclude<TourEntryVariant, 'deal'>, option: string, state: TourState) {
  window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
    detail: {
      name: 'entry_variant_selected',
      locale,
      viewport_group: viewportGroup(),
      entry_variant: variant,
      option,
      perspective: state.perspective,
      lens: state.lens,
      stage: state.stage,
      scenario: state.scenario,
    },
  }));
}

export function PublicDealEntryGate({
  copy,
  entryCopy,
  locale,
  initialEntry,
  initialState,
}: {
  copy: PublicProductExperienceCopy;
  entryCopy: PublicProductEntryVariantsCopy;
  locale: string;
  initialEntry: TourEntryVariant;
  initialState: TourState;
}) {
  const [entry, setEntry] = useState<TourEntryVariant>(initialEntry);
  const [state, setState] = useState<TourState>(initialState);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setEntry(normalizeTourEntryVariant(params.get('entry') ?? undefined));
      setState(normalizeTourStateFromSearchParams(params, initialState));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialState]);

  const openDeal = (
    next: TourState,
    source: 'role-first' | 'problem-first' | 'direct-from-entry',
    option?: string,
  ) => {
    const params = writeTourStateToSearchParams(next, new URLSearchParams(window.location.search));
    params.set('entry', 'deal');
    params.set('source', source);
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.pushState({}, '', url);
    setState(next);
    setEntry('deal');
    if (source !== 'direct-from-entry' && option) {
      emit(locale, source === 'role-first' ? 'role' : 'problem', option, next);
    }
  };

  if (entry === 'deal') {
    return <PublicDealExplorer copy={copy} locale={locale} initialState={state} />;
  }

  const roleFirst = entry === 'role';
  return (
    <section className='pc-ppe-entry-gate' aria-labelledby='pc-ppe-entry-gate-title' data-entry-variant={entry}>
      <span className='pc-ppe-example-badge'>{entryCopy.experimentBadge}</span>
      <h2 id='pc-ppe-entry-gate-title'>{roleFirst ? entryCopy.role.title : entryCopy.problem.title}</h2>
      <p>{roleFirst ? entryCopy.role.lead : entryCopy.problem.lead}</p>

      <div className='pc-ppe-entry-options' role='group' aria-labelledby='pc-ppe-entry-gate-title'>
        {roleFirst
          ? entryCopy.role.options.map((option) => (
            <button
              key={option.id}
              type='button'
              className='pc-ppe-entry-option'
              onClick={() => openDeal({
                ...state,
                perspective: option.perspective,
                lens: option.lens,
              }, 'role-first', option.id)}
            >
              <span className='pc-ppe-icon-well'><PublicExperienceIcon name={option.perspective} size={23} /></span>
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
              <PublicExperienceIcon name='arrow' size={20} />
            </button>
          ))
          : entryCopy.problem.options.map((option) => (
            <button
              key={option.id}
              type='button'
              className='pc-ppe-entry-option'
              onClick={() => openDeal({ ...state, lens: option.lens }, 'problem-first', option.id)}
            >
              <span className='pc-ppe-icon-well'><PublicExperienceIcon name={option.lens} size={23} /></span>
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
              <PublicExperienceIcon name='arrow' size={20} />
            </button>
          ))}
      </div>

      <div className='pc-ppe-entry-gate-actions'>
        <button
          type='button'
          className='pc-ppe-secondary-button'
          onClick={() => openDeal(state, 'direct-from-entry')}
        >
          {entryCopy.direct}
        </button>
        <a href={`/platform-v7?lang=${encodeURIComponent(locale)}`} className='pc-ppe-text-button'>{entryCopy.back}</a>
      </div>
    </section>
  );
}
