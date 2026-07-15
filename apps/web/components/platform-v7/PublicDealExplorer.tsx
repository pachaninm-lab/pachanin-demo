'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import {
  DEFAULT_TOUR_STATE,
  TOUR_LENSES,
  TOUR_PERSPECTIVES,
  TOUR_RISKS,
  TOUR_SCENARIOS,
  TOUR_STAGES,
  normalizeTourStateFromSearchParams,
  reduceTourState,
  writeTourStateToSearchParams,
  type TourEvent,
  type TourLens,
  type TourPerspective,
  type TourRisk,
  type TourScenario,
  type TourStage,
  type TourState,
} from '@/lib/platform-v7/public-product-experience-state';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';

const moneyFlow: TourStage[] = ['deal', 'logistics', 'acceptance', 'laboratory', 'documents', 'settlement', 'closure'];

type AnalyticsEvent =
  | 'deal_xray_open'
  | 'perspective_selected'
  | 'lens_selected'
  | 'stage_selected'
  | 'scenario_selected'
  | 'risk_selected'
  | 'document_open'
  | 'ai_layer_enabled'
  | 'guided_tour_started'
  | 'guided_tour_completed'
  | 'connect_cta_click';

type GuideMode = 'idle' | 'playing' | 'paused';

function viewportGroup() {
  if (typeof window === 'undefined') return 'server';
  if (window.innerWidth < 720) return 'mobile';
  if (window.innerWidth < 1100) return 'tablet';
  return 'desktop';
}

function emit(name: AnalyticsEvent, locale: string, state: TourState, extra: Record<string, string> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
    detail: {
      name,
      locale,
      viewport_group: viewportGroup(),
      perspective: state.perspective,
      lens: state.lens,
      stage: state.stage,
      scenario: state.scenario,
      ...extra,
    },
  }));
}

export function PublicDealExplorer({
  copy,
  locale,
  initialState,
}: {
  copy: PublicProductExperienceCopy;
  locale: string;
  initialState: TourState;
}) {
  const [state, setState] = useState<TourState>(initialState);
  const [guideMode, setGuideMode] = useState<GuideMode>('idle');
  const mounted = useRef(false);

  const stage = copy.explorer.stages[state.stage];
  const perspective = copy.explorer.perspectives[state.perspective];
  const scenario = copy.explorer.scenarios[state.scenario];
  const risk = copy.explorer.risks[state.risk];

  const blocker = state.scenario === 'standard'
    ? copy.explorer.deal.noBlocker
    : scenario.blocker;

  const commit = (
    event: TourEvent,
    analytics?: AnalyticsEvent,
    extra: Record<string, string> = {},
    historyMode: 'push' | 'replace' = 'push',
  ) => {
    setState((current) => {
      const next = reduceTourState(current, event);
      if (next === current) return current;
      if (typeof window !== 'undefined') {
        const params = writeTourStateToSearchParams(next, new URLSearchParams(window.location.search));
        const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
        window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({}, '', url);
      }
      if (analytics) emit(analytics, locale, next, extra);
      return next;
    });
  };

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    emit('deal_xray_open', locale, state, { source: 'how_it_works' });
  }, [locale, state]);

  useEffect(() => {
    const onPopState = () => {
      const next = normalizeTourStateFromSearchParams(new URLSearchParams(window.location.search), DEFAULT_TOUR_STATE);
      setState(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (guideMode !== 'playing') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGuideMode('paused');
      return;
    }
    if (state.stage === 'closure') {
      setGuideMode('idle');
      emit('guided_tour_completed', locale, state);
      return;
    }
    const timer = window.setTimeout(() => {
      commit({ type: 'next-stage' }, undefined, {}, 'replace');
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [guideMode, locale, state]);

  const currentStageIndex = TOUR_STAGES.indexOf(state.stage);
  const currentLens = copy.explorer.lenses[state.lens];

  const selectedDocuments = useMemo(() => {
    if (state.scenario === 'dispute') return copy.explorer.documents;
    if (state.stage === 'acceptance') return copy.explorer.documents.slice(0, 1);
    if (state.stage === 'laboratory') return copy.explorer.documents.slice(0, 2);
    return copy.explorer.documents;
  }, [copy.explorer.documents, state.scenario, state.stage]);

  const selectLens = (lens: TourLens) => commit({ type: 'select-lens', lens }, 'lens_selected');
  const selectPerspective = (value: TourPerspective) => commit({ type: 'select-perspective', perspective: value }, 'perspective_selected');
  const selectScenario = (value: TourScenario) => commit({ type: 'select-scenario', scenario: value }, 'scenario_selected');
  const selectStage = (value: TourStage) => commit({ type: 'select-stage', stage: value }, 'stage_selected');
  const selectRisk = (value: TourRisk) => commit({ type: 'select-risk', risk: value }, 'risk_selected');

  return (
    <div className='pc-ppe-explorer' data-lens={state.lens} data-scenario={state.scenario}>
      <div className='pc-ppe-explorer-toolbar' aria-label={copy.explorer.controls.scenario}>
        <div className='pc-ppe-segmented' role='group' aria-label={copy.explorer.controls.scenario}>
          {TOUR_SCENARIOS.map((key) => (
            <button
              key={key}
              type='button'
              aria-pressed={state.scenario === key}
              data-active={state.scenario === key ? 'true' : 'false'}
              onClick={() => selectScenario(key)}
            >
              {copy.explorer.scenarios[key].label}
            </button>
          ))}
        </div>

        <div className='pc-ppe-guide-controls'>
          {guideMode === 'idle' ? (
            <button
              type='button'
              className='pc-ppe-secondary-button'
              onClick={() => {
                setGuideMode('playing');
                if (state.stage === 'closure') commit({ type: 'select-stage', stage: 'terms' }, undefined, {}, 'replace');
                emit('guided_tour_started', locale, state);
              }}
            >
              <PublicExperienceIcon name='play' size={18} />
              <span>{copy.explorer.controls.startGuide}</span>
            </button>
          ) : (
            <>
              <button
                type='button'
                className='pc-ppe-icon-button'
                aria-label={guideMode === 'playing' ? copy.explorer.controls.pause : copy.explorer.controls.continue}
                onClick={() => setGuideMode((mode) => mode === 'playing' ? 'paused' : 'playing')}
              >
                <PublicExperienceIcon name={guideMode === 'playing' ? 'pause' : 'play'} size={19} />
              </button>
              <button type='button' className='pc-ppe-text-button' onClick={() => setGuideMode('idle')}>
                {copy.explorer.controls.stop}
              </button>
            </>
          )}
        </div>
      </div>

      <div className='pc-ppe-explorer-grid'>
        <nav className='pc-ppe-lens-nav' aria-label={copy.explorer.controls.lens}>
          <span className='pc-ppe-control-label'>{copy.explorer.controls.lens}</span>
          <div className='pc-ppe-lens-list'>
            {TOUR_LENSES.map((key) => (
              <button
                key={key}
                type='button'
                aria-current={state.lens === key ? 'page' : undefined}
                data-active={state.lens === key ? 'true' : 'false'}
                onClick={() => selectLens(key)}
              >
                <PublicExperienceIcon name={key} size={21} />
                <span>{copy.explorer.lenses[key].label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className='pc-ppe-explorer-main'>
          <DealCard copy={copy} stage={stage} scenario={scenario} blocker={blocker} />
          <section className='pc-ppe-lens-panel' aria-labelledby='pc-ppe-current-lens'>
            <header className='pc-ppe-panel-heading'>
              <div className='pc-ppe-icon-well'><PublicExperienceIcon name={state.lens} size={24} /></div>
              <div>
                <h2 id='pc-ppe-current-lens'>{currentLens.label}</h2>
                <p>{currentLens.summary}</p>
              </div>
            </header>

            {state.lens === 'execution' ? (
              <ExecutionLens copy={copy} stage={stage} />
            ) : null}

            {state.lens === 'participants' ? (
              <ParticipantsLens copy={copy} state={state} onSelect={selectPerspective} />
            ) : null}

            {state.lens === 'documents' ? (
              <DocumentsLens copy={copy} documents={selectedDocuments} locale={locale} state={state} />
            ) : null}

            {state.lens === 'money' ? (
              <MoneyLens copy={copy} state={state} scenario={scenario} />
            ) : null}

            {state.lens === 'risk' ? (
              <RiskLens copy={copy} state={state} risk={risk} onSelect={selectRisk} />
            ) : null}

            {state.lens === 'intelligence' ? (
              <IntelligenceLens
                copy={copy}
                enabled={state.aiEnabled}
                onToggle={(enabled) => commit({ type: 'set-ai', enabled }, enabled ? 'ai_layer_enabled' : undefined)}
              />
            ) : null}
          </section>
        </div>

        <aside className='pc-ppe-context-panel' aria-label={copy.explorer.controls.perspective}>
          <span className='pc-ppe-control-label'>{copy.explorer.controls.perspective}</span>
          <label className='pc-ppe-select-label'>
            <span>{copy.explorer.controls.perspective}</span>
            <select value={state.perspective} onChange={(event) => selectPerspective(event.target.value as TourPerspective)}>
              {TOUR_PERSPECTIVES.map((key) => <option key={key} value={key}>{copy.explorer.perspectives[key].label}</option>)}
            </select>
          </label>

          <div className='pc-ppe-context-summary'>
            <div className='pc-ppe-icon-well'><PublicExperienceIcon name={state.perspective} size={24} /></div>
            <strong>{perspective.label}</strong>
            <p>{perspective.value}</p>
          </div>

          <dl className='pc-ppe-context-list'>
            <div><dt>{copy.explorer.labels.action}</dt><dd>{perspective.action}</dd></div>
            <div><dt>{copy.explorer.labels.visibleDocuments}</dt><dd>{perspective.documents}</dd></div>
            <div><dt>{copy.explorer.labels.roleRisk}</dt><dd>{perspective.risk}</dd></div>
            <div><dt>{copy.explorer.labels.moneyContext}</dt><dd>{perspective.money}</dd></div>
          </dl>
        </aside>
      </div>

      <section className='pc-ppe-timeline' aria-labelledby='pc-ppe-timeline-title'>
        <div className='pc-ppe-timeline-head'>
          <div>
            <span className='pc-ppe-control-label'>{copy.explorer.controls.stage}</span>
            <h2 id='pc-ppe-timeline-title'>{stage.label}</h2>
          </div>
          <div className='pc-ppe-stage-nav'>
            <button
              type='button'
              className='pc-ppe-icon-button'
              aria-label={copy.explorer.controls.previous}
              disabled={currentStageIndex === 0}
              onClick={() => commit({ type: 'previous-stage' }, 'stage_selected')}
            >
              <PublicExperienceIcon name='arrow' size={20} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button
              type='button'
              className='pc-ppe-icon-button'
              aria-label={copy.explorer.controls.next}
              disabled={currentStageIndex === TOUR_STAGES.length - 1}
              onClick={() => commit({ type: 'next-stage' }, 'stage_selected')}
            >
              <PublicExperienceIcon name='arrow' size={20} />
            </button>
          </div>
        </div>

        <div className='pc-ppe-stage-track' role='group' aria-label={copy.explorer.controls.stage}>
          {TOUR_STAGES.map((key, index) => {
            const active = key === state.stage;
            const complete = index < currentStageIndex;
            return (
              <button
                key={key}
                type='button'
                aria-current={active ? 'step' : undefined}
                data-state={active ? 'active' : complete ? 'complete' : 'pending'}
                onClick={() => selectStage(key)}
              >
                <span className='pc-ppe-stage-dot'>{complete ? <PublicExperienceIcon name='check' size={14} /> : index + 1}</span>
                <span>{copy.explorer.stages[key].label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className='pc-ppe-boundary-note'>
        <strong>{copy.explorer.boundaries.title}</strong>
        <p>{copy.explorer.boundaries.text}</p>
      </div>

      <div className='pc-ppe-explorer-cta'>
        <a
          href='/platform-v7/register'
          className='pc-ppe-primary-button'
          onClick={() => emit('connect_cta_click', locale, state, { source: 'how_it_works' })}
        >
          <span>{copy.explorer.connect}</span>
          <PublicExperienceIcon name='arrow' size={19} />
        </a>
      </div>
    </div>
  );
}

function DealCard({
  copy,
  stage,
  scenario,
  blocker,
}: {
  copy: PublicProductExperienceCopy;
  stage: PublicProductExperienceCopy['explorer']['stages'][TourStage];
  scenario: PublicProductExperienceCopy['explorer']['scenarios'][TourScenario];
  blocker: string;
}) {
  const deal = copy.explorer.deal;
  return (
    <article className='pc-ppe-deal-card' aria-labelledby='pc-ppe-deal-card-title'>
      <div className='pc-ppe-deal-card-top'>
        <span className='pc-ppe-example-badge'>{copy.explorer.exampleBadge}</span>
        <strong id='pc-ppe-deal-card-title'>{deal.id}</strong>
      </div>

      <dl className='pc-ppe-deal-facts'>
        <div><dt>{deal.commodityLabel}</dt><dd>{deal.commodity}</dd></div>
        <div><dt>{deal.classLabel}</dt><dd>{deal.classValue}</dd></div>
        <div><dt>{deal.volumeLabel}</dt><dd>{deal.volume}</dd></div>
        <div><dt>{deal.priceLabel}</dt><dd>{deal.price}</dd></div>
        <div><dt>{deal.amountLabel}</dt><dd>{deal.amount}</dd></div>
        <div><dt>{deal.routeLabel}</dt><dd>{deal.route}</dd></div>
      </dl>

      <dl className='pc-ppe-deal-state'>
        <div data-tone='current'><dt>{deal.stageLabel}</dt><dd>{stage.label}</dd></div>
        <div data-tone='action'><dt>{deal.statusLabel}</dt><dd>{deal.status}</dd></div>
        <div><dt>{deal.ownerLabel}</dt><dd>{stage.owner}</dd></div>
        <div><dt>{deal.nextLabel}</dt><dd>{stage.action}</dd></div>
        <div data-tone={blocker === deal.noBlocker ? 'confirmed' : 'blocked'}><dt>{deal.blockerLabel}</dt><dd>{blocker}</dd></div>
        <div data-tone='external'><dt>{copy.explorer.controls.scenario}</dt><dd>{scenario.label}</dd></div>
      </dl>
    </article>
  );
}

function ExecutionLens({ copy, stage }: { copy: PublicProductExperienceCopy; stage: PublicProductExperienceCopy['explorer']['stages'][TourStage] }) {
  const items = [
    [copy.explorer.labels.happened, stage.happened],
    [copy.explorer.labels.responsible, stage.owner],
    [copy.explorer.labels.action, stage.action],
    [copy.explorer.labels.evidence, stage.evidence],
    [copy.explorer.labels.transition, stage.next],
  ];
  return (
    <dl className='pc-ppe-causal-list'>
      {items.map(([label, value], index) => (
        <div key={label}>
          <dt>
            <span className='pc-ppe-causal-index' aria-hidden='true'>{index + 1}</span>
            <span>{label}</span>
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ParticipantsLens({
  copy,
  state,
  onSelect,
}: {
  copy: PublicProductExperienceCopy;
  state: TourState;
  onSelect: (value: TourPerspective) => void;
}) {
  const selected = copy.explorer.perspectives[state.perspective];
  return (
    <div className='pc-ppe-participants-lens'>
      <div className='pc-ppe-participant-grid' role='group' aria-label={copy.explorer.controls.allParticipants}>
        {TOUR_PERSPECTIVES.map((key) => (
          <button
            key={key}
            type='button'
            aria-pressed={state.perspective === key}
            data-active={state.perspective === key ? 'true' : 'false'}
            onClick={() => onSelect(key)}
          >
            <PublicExperienceIcon name={key} size={20} />
            <span>{copy.explorer.perspectives[key].label}</span>
          </button>
        ))}
      </div>
      <dl className='pc-ppe-detail-grid'>
        <div><dt>{copy.explorer.labels.action}</dt><dd>{selected.action}</dd></div>
        <div><dt>{copy.explorer.labels.visibleDocuments}</dt><dd>{selected.documents}</dd></div>
        <div><dt>{copy.explorer.labels.responsibility}</dt><dd>{selected.responsibility}</dd></div>
        <div><dt>{copy.explorer.labels.expectedOutcome}</dt><dd>{selected.outcome}</dd></div>
        <div><dt>{copy.explorer.labels.roleRisk}</dt><dd>{selected.risk}</dd></div>
        <div><dt>{copy.explorer.labels.moneyContext}</dt><dd>{selected.money}</dd></div>
      </dl>
    </div>
  );
}

function DocumentsLens({
  copy,
  documents,
  locale,
  state,
}: {
  copy: PublicProductExperienceCopy;
  documents: PublicProductExperienceCopy['explorer']['documents'];
  locale: string;
  state: TourState;
}) {
  return (
    <div className='pc-ppe-document-chain'>
      {documents.map((document, index) => (
        <details
          key={document.name}
          className='pc-ppe-document-card'
          onToggle={(event) => {
            if ((event.currentTarget as HTMLDetailsElement).open) emit('document_open', locale, state, { document_index: String(index) });
          }}
        >
          <summary>
            <span className='pc-ppe-document-sequence'>{index + 1}</span>
            <span><strong>{document.name}</strong><small>{document.type} · {document.status}</small></span>
            <PublicExperienceIcon name='arrow' size={18} />
          </summary>
          <dl>
            <div><dt>{copy.explorer.deal.idLabel}</dt><dd>{copy.explorer.deal.id}</dd></div>
            <div><dt>{copy.explorer.deal.commodityLabel}</dt><dd>{document.party}</dd></div>
            <div><dt>{copy.explorer.deal.routeLabel}</dt><dd>{document.trip}</dd></div>
            <div><dt>{copy.explorer.labels.signature}</dt><dd>{document.signer}</dd></div>
            <div><dt>{copy.explorer.labels.version}</dt><dd>{document.version}</dd></div>
            <div><dt>SHA-256</dt><dd>{document.checksum}</dd></div>
            <div className='pc-ppe-document-basis'><dt>{copy.explorer.labels.allowedAction}</dt><dd>{document.basis}</dd></div>
          </dl>
        </details>
      ))}
    </div>
  );
}

function MoneyLens({
  copy,
  state,
  scenario,
}: {
  copy: PublicProductExperienceCopy;
  state: TourState;
  scenario: PublicProductExperienceCopy['explorer']['scenarios'][TourScenario];
}) {
  return (
    <div className='pc-ppe-money-lens'>
      <ol className='pc-ppe-money-flow'>
        {moneyFlow.map((key, index) => (
          <li key={key} data-current={key === state.stage ? 'true' : 'false'}>
            <span>{index + 1}</span>
            <strong>{copy.explorer.stages[key].label}</strong>
          </li>
        ))}
      </ol>
      <div className='pc-ppe-scenario-card' data-scenario={state.scenario}>
        <span>{scenario.label}</span>
        <strong>{scenario.amount}</strong>
        <p>{scenario.summary}</p>
        <dl>
          <div><dt>{copy.explorer.deal.blockerLabel}</dt><dd>{scenario.blocker}</dd></div>
          <div><dt>{copy.explorer.labels.outcome}</dt><dd>{scenario.outcome}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function RiskLens({
  copy,
  state,
  risk,
  onSelect,
}: {
  copy: PublicProductExperienceCopy;
  state: TourState;
  risk: PublicProductExperienceCopy['explorer']['risks'][TourRisk];
  onSelect: (value: TourRisk) => void;
}) {
  return (
    <div className='pc-ppe-risk-lens'>
      <div className='pc-ppe-risk-options' role='group' aria-label={copy.explorer.controls.risk}>
        {TOUR_RISKS.map((key) => (
          <button
            key={key}
            type='button'
            aria-pressed={state.risk === key}
            data-active={state.risk === key ? 'true' : 'false'}
            onClick={() => onSelect(key)}
          >
            {copy.explorer.risks[key].label}
          </button>
        ))}
      </div>
      <dl className='pc-ppe-risk-detail'>
        <div><dt>{copy.explorer.labels.event}</dt><dd>{risk.event}</dd></div>
        <div><dt>{copy.explorer.labels.blockedAction}</dt><dd>{risk.blocked}</dd></div>
        <div><dt>{copy.explorer.labels.responsible}</dt><dd>{risk.owner}</dd></div>
        <div><dt>{copy.explorer.labels.evidence}</dt><dd>{risk.evidence}</dd></div>
        <div><dt>{copy.explorer.labels.deadline}</dt><dd>{risk.deadline}</dd></div>
        <div><dt>{copy.explorer.labels.outcome}</dt><dd>{risk.outcome}</dd></div>
      </dl>
      <ol className='pc-ppe-dispute-chronology'>
        <li><span>1</span><strong>{copy.explorer.labels.event}</strong><p>{risk.event}</p></li>
        <li><span>2</span><strong>{copy.explorer.labels.evidence}</strong><p>{risk.evidence}</p></li>
        <li><span>3</span><strong>{copy.explorer.labels.disputedAmount}</strong><p>{copy.explorer.scenarios.dispute.amount}</p></li>
        <li><span>4</span><strong>{copy.explorer.labels.outcome}</strong><p>{risk.outcome}</p></li>
      </ol>
    </div>
  );
}

function IntelligenceLens({
  copy,
  enabled,
  onToggle,
}: {
  copy: PublicProductExperienceCopy;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className='pc-ppe-ai-lens'>
      <button
        type='button'
        className='pc-ppe-ai-toggle'
        role='switch'
        aria-checked={enabled}
        data-active={enabled ? 'true' : 'false'}
        onClick={() => onToggle(!enabled)}
      >
        <span aria-hidden='true'><i /></span>
        <strong>{copy.explorer.controls.aiToggle}</strong>
      </button>

      {enabled ? (
        <div className='pc-ppe-ai-signals' aria-live='polite'>
          {copy.explorer.aiSignals.map((signal) => (
            <article key={signal.title}>
              <div className='pc-ppe-icon-well' data-tone='ai'><PublicExperienceIcon name='intelligence' size={22} /></div>
              <div>
                <strong>{signal.title}</strong>
                <dl>
                  <div><dt>{copy.explorer.labels.whyImportant}</dt><dd>{signal.why}</dd></div>
                  <div><dt>{copy.explorer.labels.affectedObject}</dt><dd>{signal.object}</dd></div>
                  <div><dt>{copy.explorer.labels.recommendation}</dt><dd>{signal.recommendation}</dd></div>
                  <div><dt>{copy.explorer.labels.confidence}</dt><dd>{signal.confidence}</dd></div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className='pc-ppe-ai-empty'>
          <PublicExperienceIcon name='intelligence' size={28} />
          <p>{copy.explorer.boundaries.ai}</p>
        </div>
      )}
    </div>
  );
}
