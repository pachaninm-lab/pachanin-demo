'use client';

import { useEffect, useMemo, useState } from 'react';
import { PublicDealExplorer } from '@/components/platform-v7/PublicDealExplorer';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import {
  normalizeTourStateFromSearchParams,
  type TourLens,
  type TourState,
} from '@/lib/platform-v7/public-product-experience-state';

const publicBusinessAreas = new Set<TourLens>(['execution', 'documents', 'money', 'risk']);

function canonicalFunnelName(detail: Record<string, unknown>) {
  const name = typeof detail.name === 'string' ? detail.name : '';
  if (name === 'deal_xray_open') return 'deal_preview_opened';
  if (name === 'perspective_selected') return 'role_selected';
  if (name === 'scenario_selected' || name === 'guided_tour_started') return 'scenario_started';
  if (name === 'guided_tour_completed') return 'scenario_completed';
  if (name === 'connect_cta_click') return 'organization_connect_started';
  return null;
}

export function PublicDealExplorerV4({
  copy,
  locale,
  initialState,
}: {
  copy: PublicProductExperienceCopy;
  locale: string;
  initialState: TourState;
}) {
  const ui = getPublicProductExperienceV4Copy(locale);
  const normalizedState = useMemo<TourState>(() => (
    publicBusinessAreas.has(initialState.lens)
      ? initialState
      : { ...initialState, lens: 'execution' }
  ), [initialState]);
  const [historyState, setHistoryState] = useState<TourState>(normalizedState);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => {
    const bridge = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object'
        ? event.detail as Record<string, unknown>
        : {};
      const name = canonicalFunnelName(detail);
      if (!name) return;
      window.dispatchEvent(new CustomEvent('pc:public-product-funnel', {
        detail: { ...detail, name, source_event: detail.name },
      }));
    };

    window.addEventListener('pc:public-product-analytics', bridge);
    return () => window.removeEventListener('pc:public-product-analytics', bridge);
  }, []);

  useEffect(() => {
    const restorePublicHistoryState = () => {
      const next = normalizeTourStateFromSearchParams(
        new URLSearchParams(window.location.search),
        normalizedState,
      );
      setHistoryState(next);
      setHistoryRevision((revision) => revision + 1);
    };

    window.addEventListener('popstate', restorePublicHistoryState);
    return () => window.removeEventListener('popstate', restorePublicHistoryState);
  }, [normalizedState]);

  const adaptedCopy: PublicProductExperienceCopy = {
    ...copy,
    explorer: {
      ...copy.explorer,
      connect: ui.explorer.connect,
      controls: {
        ...copy.explorer.controls,
        lens: ui.explorer.lensLabel,
        perspective: ui.explorer.roleLabel,
        scenario: ui.explorer.scenarioLabel,
        startGuide: ui.explorer.startGuide,
      },
      scenarios: {
        standard: {
          ...copy.explorer.scenarios.standard,
          label: ui.explorer.scenarios.standard,
        },
        partial: {
          ...copy.explorer.scenarios.partial,
          label: ui.explorer.scenarios.partial,
        },
        dispute: {
          ...copy.explorer.scenarios.dispute,
          label: ui.explorer.scenarios.dispute,
        },
      },
    },
  };

  return (
    <>
      <style jsx global>{`
        .pc-ppe-page .pc-ppe-lens-list {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .pc-ppe-page .pc-ppe-lens-list > button:nth-child(2),
        .pc-ppe-page .pc-ppe-lens-list > button:nth-child(6) {
          display: none;
        }
        .pc-ppe-page .pc-ppe-lens-list > button {
          min-width: 0;
          min-height: 48px;
          overflow-wrap: anywhere;
        }
        .pc-ppe-page .pc-ppe-explorer-toolbar,
        .pc-ppe-page .pc-ppe-guide-controls,
        .pc-ppe-page .pc-ppe-segmented {
          min-width: 0;
        }
        @media (max-width: 720px) {
          .pc-ppe-page .pc-ppe-lens-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .pc-ppe-page .pc-ppe-lens-list > button {
            justify-content: flex-start;
            min-height: 52px;
            text-align: left;
          }
          .pc-ppe-page .pc-ppe-segmented {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
          }
          .pc-ppe-page .pc-ppe-segmented > button {
            width: 100%;
            min-height: 48px;
            white-space: normal;
          }
        }
        @media (max-width: 340px) {
          .pc-ppe-page .pc-ppe-lens-list {
            grid-template-columns: minmax(0, 1fr);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .pc-ppe-page *,
          .pc-ppe-page *::before,
          .pc-ppe-page *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      <PublicDealExplorer
        key={historyRevision}
        copy={adaptedCopy}
        locale={locale}
        initialState={historyState}
      />
    </>
  );
}
