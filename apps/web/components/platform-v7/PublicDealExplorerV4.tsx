'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicDealExplorer } from '@/components/platform-v7/PublicDealExplorer';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import {
  TOUR_STAGES,
  normalizeTourStateFromSearchParams,
  writeTourStateToSearchParams,
  type TourLens,
  type TourState,
} from '@/lib/platform-v7/public-product-experience-state';

const publicBusinessAreas = new Set<TourLens>(['execution', 'documents', 'money', 'risk']);
const GUIDE_STEP_MS = 3200;

type GuideMode = 'idle' | 'playing' | 'paused';

function canonicalFunnelName(detail: Record<string, unknown>) {
  const name = typeof detail.name === 'string' ? detail.name : '';
  if (name === 'deal_xray_open') return 'deal_preview_opened';
  if (name === 'perspective_selected') return 'role_selected';
  if (name === 'scenario_selected' || name === 'guided_tour_started') return 'scenario_started';
  if (name === 'guided_tour_completed') return 'scenario_completed';
  if (name === 'connect_cta_click') return 'organization_connect_started';
  return null;
}

function emitGuideEvent(name: 'guided_tour_started' | 'guided_tour_completed', locale: string, state: TourState) {
  window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
    detail: {
      name,
      locale,
      perspective: state.perspective,
      lens: state.lens,
      stage: state.stage,
      scenario: state.scenario,
      source: 'public_v4_guide',
    },
  }));
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
  const [guideMode, setGuideMode] = useState<GuideMode>('idle');

  const replacePresentedState = useCallback((next: TourState) => {
    const params = writeTourStateToSearchParams(next, new URLSearchParams(window.location.search));
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, '', url);
    setHistoryState(next);
    setHistoryRevision((revision) => revision + 1);
  }, []);

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

  useEffect(() => {
    if (guideMode !== 'playing') return;

    const timer = window.setTimeout(() => {
      const current = normalizeTourStateFromSearchParams(
        new URLSearchParams(window.location.search),
        historyState,
      );
      const currentIndex = TOUR_STAGES.indexOf(current.stage);

      if (currentIndex >= TOUR_STAGES.length - 1) {
        setGuideMode('idle');
        emitGuideEvent('guided_tour_completed', locale, current);
        return;
      }

      const nextStage = TOUR_STAGES[currentIndex + 1] ?? 'closure';
      replacePresentedState({ ...current, stage: nextStage });
    }, GUIDE_STEP_MS);

    return () => window.clearTimeout(timer);
  }, [guideMode, historyState, locale, replacePresentedState]);

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

  const currentStageIndex = Math.max(0, TOUR_STAGES.indexOf(historyState.stage));
  const currentStage = adaptedCopy.explorer.stages[historyState.stage];

  const startGuide = () => {
    const current = normalizeTourStateFromSearchParams(
      new URLSearchParams(window.location.search),
      historyState,
    );
    const first = { ...current, stage: 'terms' as const };
    replacePresentedState(first);
    setGuideMode('playing');
    emitGuideEvent('guided_tour_started', locale, first);
  };

  return (
    <div className='pc-ppe-v4-explorer'>
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
        .pc-ppe-page .pc-ppe-segmented {
          min-width: 0;
        }
        .pc-ppe-page .pc-ppe-explorer-toolbar > .pc-ppe-guide-controls {
          display: none;
        }
        .pc-ppe-v4-guide-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid var(--pc-ppe-line);
          border-radius: 18px;
          background: #fff;
        }
        .pc-ppe-v4-guide-progress {
          display: grid;
          flex: 1 1 260px;
          min-width: 0;
          gap: 7px;
        }
        .pc-ppe-v4-guide-status {
          color: var(--pc-ppe-green-dark);
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
        }
        .pc-ppe-v4-guide-progress progress {
          width: 100%;
          height: 8px;
          accent-color: var(--pc-ppe-green);
        }
        .pc-ppe-v4-guide-actions {
          display: flex;
          align-items: center;
          gap: 8px;
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
          .pc-ppe-v4-guide-bar {
            align-items: stretch;
            flex-direction: column;
          }
          .pc-ppe-v4-guide-progress {
            flex-basis: auto;
          }
          .pc-ppe-v4-guide-actions,
          .pc-ppe-v4-guide-actions .pc-ppe-secondary-button {
            width: 100%;
          }
          .pc-ppe-v4-guide-actions .pc-ppe-text-button {
            flex: 1 1 auto;
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

      <div className='pc-ppe-v4-guide-bar' data-guide-mode={guideMode}>
        {guideMode === 'idle' ? (
          <div className='pc-ppe-v4-guide-actions'>
            <button type='button' className='pc-ppe-secondary-button' onClick={startGuide}>
              <PublicExperienceIcon name='play' size={18} />
              <span>{adaptedCopy.explorer.controls.startGuide}</span>
            </button>
          </div>
        ) : (
          <>
            <div className='pc-ppe-v4-guide-progress'>
              <span className='pc-ppe-v4-guide-status' aria-live='polite'>
                {currentStageIndex + 1} / {TOUR_STAGES.length} · {currentStage.label}
              </span>
              <progress value={currentStageIndex + 1} max={TOUR_STAGES.length} aria-label={currentStage.label} />
            </div>
            <div className='pc-ppe-v4-guide-actions'>
              <button
                type='button'
                className='pc-ppe-icon-button'
                aria-label={guideMode === 'playing' ? adaptedCopy.explorer.controls.pause : adaptedCopy.explorer.controls.continue}
                onClick={() => setGuideMode((mode) => mode === 'playing' ? 'paused' : 'playing')}
              >
                <PublicExperienceIcon name={guideMode === 'playing' ? 'pause' : 'play'} size={19} />
              </button>
              <button type='button' className='pc-ppe-text-button' onClick={() => setGuideMode('idle')}>
                {adaptedCopy.explorer.controls.stop}
              </button>
            </div>
          </>
        )}
      </div>

      <PublicDealExplorer
        key={historyRevision}
        copy={adaptedCopy}
        locale={locale}
        initialState={historyState}
      />
    </div>
  );
}
