'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicDealExplorer } from '@/components/platform-v7/PublicDealExplorer';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import {
  TOUR_PERSPECTIVES,
  TOUR_SCENARIOS,
  TOUR_STAGES,
  normalizeTourStateFromSearchParams,
  writeTourStateToSearchParams,
  type TourLens,
  type TourPerspective,
  type TourScenario,
  type TourState,
} from '@/lib/platform-v7/public-product-experience-state';

const publicBusinessAreas = new Set<TourLens>(['execution', 'documents', 'money', 'risk']);
const GUIDE_STEP_MS = 3200;

type GuideMode = 'idle' | 'playing' | 'paused';
type MobileSelectionEvent = 'perspective_selected' | 'scenario_selected';

function normalizePublicBusinessState(state: TourState): TourState {
  return publicBusinessAreas.has(state.lens)
    ? state
    : { ...state, lens: 'execution' };
}

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

function emitMobileSelection(name: MobileSelectionEvent, locale: string, state: TourState) {
  window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
    detail: {
      name,
      locale,
      perspective: state.perspective,
      lens: state.lens,
      stage: state.stage,
      scenario: state.scenario,
      source: 'public_v4_mobile_controls',
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
  const normalizedState = useMemo<TourState>(
    () => normalizePublicBusinessState(initialState),
    [initialState],
  );
  const [historyState, setHistoryState] = useState<TourState>(normalizedState);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [guideMode, setGuideMode] = useState<GuideMode>('idle');

  const replacePresentedState = useCallback((next: TourState) => {
    const normalizedNext = normalizePublicBusinessState(next);
    const params = writeTourStateToSearchParams(normalizedNext, new URLSearchParams(window.location.search));
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, '', url);
    setHistoryState(normalizedNext);
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
      const next = normalizePublicBusinessState(normalizeTourStateFromSearchParams(
        new URLSearchParams(window.location.search),
        normalizedState,
      ));
      setHistoryState(next);
      setHistoryRevision((revision) => revision + 1);
    };

    window.addEventListener('popstate', restorePublicHistoryState);
    return () => window.removeEventListener('popstate', restorePublicHistoryState);
  }, [normalizedState]);

  useEffect(() => {
    if (guideMode !== 'playing') return;

    const timer = window.setTimeout(() => {
      const current = normalizePublicBusinessState(normalizeTourStateFromSearchParams(
        new URLSearchParams(window.location.search),
        historyState,
      ));
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

  const readPresentedState = () => normalizePublicBusinessState(normalizeTourStateFromSearchParams(
    new URLSearchParams(window.location.search),
    historyState,
  ));

  const selectMobilePerspective = (perspective: TourPerspective) => {
    const next = { ...readPresentedState(), perspective };
    replacePresentedState(next);
    emitMobileSelection('perspective_selected', locale, next);
  };

  const selectMobileScenario = (scenario: TourScenario) => {
    const next = { ...readPresentedState(), scenario };
    replacePresentedState(next);
    emitMobileSelection('scenario_selected', locale, next);
  };

  const startGuide = () => {
    const current = readPresentedState();
    const first = { ...current, stage: 'terms' as const };
    replacePresentedState(first);
    setGuideMode('playing');
    emitGuideEvent('guided_tour_started', locale, first);
  };

  return (
    <div className='pc-ppe-v4-explorer'>
      <style jsx global>{`
        .pc-ppe-v4-mobile-controls {
          display: none;
        }
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
          .pc-ppe-page {
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
          }
          .pc-ppe-page .pc-ppe-explorer-intro {
            padding-bottom: 22px;
          }
          .pc-ppe-page .pc-ppe-explorer-intro h1 {
            font-size: clamp(34px, 9.4vw, 40px);
            line-height: 1.05;
          }
          .pc-ppe-page .pc-ppe-explorer-intro > div > p {
            font-size: 16px;
            line-height: 1.48;
          }
          .pc-ppe-page .pc-ppe-demo-banner {
            margin-top: 15px;
            padding: 11px 12px;
            font-size: 13px;
            line-height: 1.42;
          }
          .pc-ppe-v4-mobile-controls {
            display: grid;
            gap: 14px;
            margin-bottom: 12px;
            padding: 14px;
            border: 1px solid var(--pc-ppe-line);
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 8px 24px rgba(19, 49, 34, 0.05);
          }
          .pc-ppe-v4-mobile-role,
          .pc-ppe-v4-mobile-scenario {
            display: grid;
            gap: 8px;
            min-width: 0;
          }
          .pc-ppe-v4-mobile-role > span,
          .pc-ppe-v4-mobile-scenario > span {
            color: #66766e;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.07em;
            text-transform: uppercase;
          }
          .pc-ppe-v4-mobile-role select {
            width: 100%;
            min-height: 48px;
            padding: 10px 38px 10px 12px;
            border: 1px solid #b9c9c0;
            border-radius: 12px;
            background: #fff;
            color: var(--pc-ppe-ink);
            font: inherit;
            font-weight: 750;
          }
          .pc-ppe-v4-mobile-scenario-list {
            display: flex;
            gap: 8px;
            min-width: 0;
            overflow-x: auto;
            padding: 1px 1px 3px;
            scrollbar-width: thin;
            scroll-snap-type: x proximity;
          }
          .pc-ppe-v4-mobile-scenario-list > button {
            flex: 0 0 auto;
            min-height: 44px;
            padding: 9px 13px;
            border: 1px solid #c8d5cd;
            border-radius: 999px;
            background: #fff;
            color: #43564d;
            font: inherit;
            font-size: 13px;
            font-weight: 750;
            white-space: nowrap;
            scroll-snap-align: start;
          }
          .pc-ppe-v4-mobile-scenario-list > button[data-active='true'] {
            border-color: #73a987;
            background: var(--pc-ppe-green-soft);
            color: var(--pc-ppe-green-dark);
            box-shadow: inset 0 0 0 1px rgba(8, 122, 59, 0.08);
          }
          .pc-ppe-page .pc-ppe-explorer-toolbar {
            display: none;
          }
          .pc-ppe-page .pc-ppe-explorer-grid {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas:
              'lenses'
              'main'
              'context';
            gap: 12px;
          }
          .pc-ppe-page .pc-ppe-context-panel .pc-ppe-select-label {
            display: none;
          }
          .pc-ppe-page .pc-ppe-lens-list {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .pc-ppe-page .pc-ppe-lens-list > button {
            justify-content: flex-start;
            min-height: 50px;
            text-align: left;
          }
          .pc-ppe-v4-guide-bar {
            align-items: stretch;
            flex-direction: column;
            margin-bottom: 12px;
            border-radius: 16px;
          }
          .pc-ppe-v4-guide-bar[data-guide-mode='idle'] {
            padding: 0;
            border: 0;
            background: transparent;
          }
          .pc-ppe-v4-guide-progress {
            flex-basis: auto;
          }
          .pc-ppe-v4-guide-actions,
          .pc-ppe-v4-guide-actions .pc-ppe-primary-button,
          .pc-ppe-v4-guide-actions .pc-ppe-secondary-button {
            width: 100%;
          }
          .pc-ppe-v4-guide-actions .pc-ppe-text-button {
            flex: 1 1 auto;
          }
          body .pc-public-contact-dock {
            right: max(8px, env(safe-area-inset-right, 0px)) !important;
            bottom: max(8px, env(safe-area-inset-bottom, 0px)) !important;
            width: min(286px, calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))) !important;
            border-radius: 14px !important;
          }
          body .pc-public-contact-dock-action {
            min-height: 44px !important;
            padding-inline: 4px !important;
          }
          body .pc-public-contact-dock-action strong {
            font-size: 11px !important;
          }
          body .pc-public-contact-dock-icon {
            width: 23px !important;
            height: 23px !important;
            flex-basis: 23px !important;
          }
        }
        @media (max-width: 360px) {
          .pc-ppe-page .pc-ppe-lens-list {
            grid-template-columns: minmax(0, 1fr);
          }
          .pc-ppe-v4-mobile-scenario-list > button {
            font-size: 12px;
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

      <div className='pc-ppe-v4-mobile-controls' aria-label={adaptedCopy.explorer.controls.scenario}>
        <label className='pc-ppe-v4-mobile-role'>
          <span>{adaptedCopy.explorer.controls.perspective}</span>
          <select
            value={historyState.perspective}
            onChange={(event) => selectMobilePerspective(event.target.value as TourPerspective)}
          >
            {TOUR_PERSPECTIVES.map((key) => (
              <option key={key} value={key}>{adaptedCopy.explorer.perspectives[key].label}</option>
            ))}
          </select>
        </label>

        <div className='pc-ppe-v4-mobile-scenario'>
          <span>{adaptedCopy.explorer.controls.scenario}</span>
          <div className='pc-ppe-v4-mobile-scenario-list' role='group' aria-label={adaptedCopy.explorer.controls.scenario}>
            {TOUR_SCENARIOS.map((key) => (
              <button
                key={key}
                type='button'
                aria-pressed={historyState.scenario === key}
                data-active={historyState.scenario === key ? 'true' : 'false'}
                onClick={() => selectMobileScenario(key)}
              >
                {adaptedCopy.explorer.scenarios[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className='pc-ppe-v4-guide-bar' data-guide-mode={guideMode}>
        {guideMode === 'idle' ? (
          <div className='pc-ppe-v4-guide-actions'>
            <button type='button' className='pc-ppe-primary-button' onClick={startGuide}>
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
