'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PublicDealExplorer } from '@/components/platform-v7/PublicDealExplorer';
import { PublicExperienceIcon } from '@/components/platform-v7/PublicExperienceIcon';
import type { PublicProductExperienceCopy } from '@/i18n/public-product-experience-v3';
import { getPublicProductExperienceV4Copy } from '@/i18n/public-product-experience-v4';
import {
  DEAL_JOURNEY_INTENTS,
  getPublicDealJourneyV5Copy,
  type DealJourneyIntent,
} from '@/i18n/public-deal-journey-v5';
import {
  TOUR_SCENARIOS,
  TOUR_STAGES,
  normalizeTourStateFromSearchParams,
  writeTourStateToSearchParams,
  type TourLens,
  type TourPerspective,
  type TourScenario,
  type TourStage,
  type TourState,
} from '@/lib/platform-v7/public-product-experience-state';

const publicBusinessAreas = new Set<TourLens>(['execution', 'documents', 'money', 'risk']);
const GUIDE_STEP_MS = 6000;
const INTENT_QUERY_VALUES = new Set<string>(DEAL_JOURNEY_INTENTS);
const PUBLIC_PERSPECTIVES: readonly TourPerspective[] = ['seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor', 'bank', 'operator'];
const STAFF_PERSPECTIVES = new Set<TourPerspective>(['operator', 'compliance', 'arbitrator', 'executive']);

type GuideMode = 'idle' | 'playing' | 'paused';
type JourneyMode = 'quick' | 'detailed';
type JourneyIntentSelection = DealJourneyIntent | 'other';
type MobileSelectionEvent = 'perspective_selected' | 'scenario_selected';

const PUBLIC_PRESENTATION = {
  ru: {
    contextLabel: 'Контекст этапа',
    context: 'Факты · основания · следующий шаг',
    noBlocker: 'Блокирующее основание отсутствует',
    logisticsAction: 'Подтвердить события рейса и относящиеся к нему основания.',
    documentsNext: 'Проверяются основания для расчёта.',
    sellerValue: 'Видит товар, поставку, документы и основания расчёта.',
    sellerOutcome: 'Подтверждённое исполнение и понятное основание расчёта.',
    elevatorValue: 'Фиксирует прибытие, вес, приёмку, размещение и факты по партии.',
    elevatorDocuments: 'Рейс, весовые данные, акт приёмки и факты по партии.',
    operatorDocuments: 'События, основания, версии документов и решения.',
    qualityDeviationBlocked: 'Финансовое действие до подтверждения основания.',
    missingDocumentBlocked: 'Финансовое действие до комплекта оснований.',
    documentContexts: ['Основание приёмки', 'Основание качества', 'Основание расчёта'],
  },
  en: {
    contextLabel: 'Stage context',
    context: 'Facts · grounds · next action',
    noBlocker: 'No blocking ground',
    logisticsAction: 'Confirm trip events and their supporting grounds.',
    documentsNext: 'Settlement grounds are checked.',
    sellerValue: 'Sees product, delivery, documents and settlement grounds.',
    sellerOutcome: 'Confirmed execution and a clear settlement basis.',
    elevatorValue: 'Records arrival, weight, acceptance, placement and lot facts.',
    elevatorDocuments: 'Trip, weight data, acceptance act and lot facts.',
    operatorDocuments: 'Events, grounds, document versions and decisions.',
    qualityDeviationBlocked: 'Financial action before the relevant grounds are confirmed.',
    missingDocumentBlocked: 'Financial action before the required grounds are complete.',
    documentContexts: ['Acceptance ground', 'Quality ground', 'Settlement ground'],
  },
  zh: {
    contextLabel: '阶段上下文',
    context: '事实 · 依据 · 下一步',
    noBlocker: '不存在阻塞依据',
    logisticsAction: '确认运输事件及其相关依据。',
    documentsNext: '核对结算依据。',
    sellerValue: '查看商品、交付、文件和结算依据。',
    sellerOutcome: '履约事实已确认，结算依据清晰。',
    elevatorValue: '记录到达、重量、验收、存放和批次事实。',
    elevatorDocuments: '运输任务、称重数据、验收记录和批次事实。',
    operatorDocuments: '事件、依据、文件版本和决定。',
    qualityDeviationBlocked: '相关依据确认前不进入金融操作。',
    missingDocumentBlocked: '所需依据完整前不进入金融操作。',
    documentContexts: ['验收依据', '质量依据', '结算依据'],
  },
} as const;

const ACTIVE_PERSPECTIVES_BY_STAGE: Record<TourStage, readonly TourPerspective[]> = {
  terms: ['seller', 'buyer'],
  admission: ['compliance', 'operator'],
  auction: ['seller', 'buyer', 'operator'],
  deal: ['seller', 'buyer', 'operator'],
  logistics: ['logistics', 'driver'],
  acceptance: ['elevator'],
  laboratory: ['lab', 'surveyor'],
  documents: ['seller', 'buyer', 'operator', 'compliance'],
  settlement: ['bank'],
  closure: ['seller', 'buyer', 'operator', 'executive'],
};

function publicPerspectiveKey(value: TourPerspective): TourPerspective {
  return STAFF_PERSPECTIVES.has(value) ? 'operator' : value;
}

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
    detail: { name, locale, perspective: state.perspective, lens: state.lens, stage: state.stage, scenario: state.scenario, source: 'public_v5_quick_journey' },
  }));
}

function emitMobileSelection(name: MobileSelectionEvent, locale: string, state: TourState, source = 'public_v5_journey_controls') {
  window.dispatchEvent(new CustomEvent('pc:public-product-analytics', {
    detail: { name, locale, perspective: state.perspective, lens: state.lens, stage: state.stage, scenario: state.scenario, source },
  }));
}

function stageIcon(stage: TourStage) {
  if (stage === 'documents') return 'documents';
  if (stage === 'settlement') return 'money';
  if (stage === 'laboratory') return 'risk';
  return 'execution';
}

export function PublicDealExplorerV4({ copy, locale, initialState }: {
  copy: PublicProductExperienceCopy;
  locale: string;
  initialState: TourState;
}) {
  const ui = getPublicProductExperienceV4Copy(locale);
  const journey = getPublicDealJourneyV5Copy(locale);
  const normalizedLocale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const presentation = PUBLIC_PRESENTATION[normalizedLocale];
  const registerHref = `/platform-v7/register?lang=${encodeURIComponent(normalizedLocale)}`;
  const normalizedState = useMemo<TourState>(() => normalizePublicBusinessState(initialState), [initialState]);
  const [historyState, setHistoryState] = useState<TourState>(normalizedState);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [guideMode, setGuideMode] = useState<GuideMode>('idle');
  const [journeyMode, setJourneyMode] = useState<JourneyMode>('quick');
  const [selectedIntent, setSelectedIntent] = useState<JourneyIntentSelection | null>(null);

  const presentState = useCallback((
    next: TourState,
    historyMode: 'push' | 'replace',
    options?: { intent?: JourneyIntentSelection | null; view?: JourneyMode },
  ) => {
    const normalizedNext = normalizePublicBusinessState(next);
    const params = writeTourStateToSearchParams(normalizedNext, new URLSearchParams(window.location.search));
    if (options && 'intent' in options) {
      if (options.intent) params.set('intent', options.intent);
      else params.delete('intent');
    }
    if (options?.view) params.set('view', options.view === 'detailed' ? 'detail' : 'quick');
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, '', url);
    setHistoryState(normalizedNext);
    setHistoryRevision((revision) => revision + 1);
  }, []);

  const replacePresentedState = useCallback((next: TourState) => presentState(next, 'replace'), [presentState]);
  const pushPresentedState = useCallback((next: TourState) => presentState(next, 'push'), [presentState]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryIntent = params.get('intent');
    const source = params.get('source');
    if (queryIntent === 'other') setSelectedIntent('other');
    else if (queryIntent && INTENT_QUERY_VALUES.has(queryIntent)) setSelectedIntent(queryIntent as DealJourneyIntent);
    else if (source === 'role-first' || source === 'problem-first') setSelectedIntent('other');
    if (params.get('view') === 'detail' || source === 'role-first' || source === 'problem-first') setJourneyMode('detailed');
  }, []);

  useEffect(() => {
    const bridge = (event: Event) => {
      const detail = event instanceof CustomEvent && event.detail && typeof event.detail === 'object' ? event.detail as Record<string, unknown> : {};
      const name = canonicalFunnelName(detail);
      if (!name) return;
      window.dispatchEvent(new CustomEvent('pc:public-product-funnel', { detail: { ...detail, name, source_event: detail.name } }));
    };
    window.addEventListener('pc:public-product-analytics', bridge);
    return () => window.removeEventListener('pc:public-product-analytics', bridge);
  }, []);

  useEffect(() => {
    const restorePublicHistoryState = () => {
      const params = new URLSearchParams(window.location.search);
      const next = normalizePublicBusinessState(normalizeTourStateFromSearchParams(params, normalizedState));
      const queryIntent = params.get('intent');
      setHistoryState(next);
      setHistoryRevision((revision) => revision + 1);
      setJourneyMode(params.get('view') === 'detail' ? 'detailed' : 'quick');
      if (queryIntent === 'other') setSelectedIntent('other');
      else if (queryIntent && INTENT_QUERY_VALUES.has(queryIntent)) setSelectedIntent(queryIntent as DealJourneyIntent);
      else setSelectedIntent(null);
    };
    window.addEventListener('popstate', restorePublicHistoryState);
    return () => window.removeEventListener('popstate', restorePublicHistoryState);
  }, [normalizedState]);

  useEffect(() => {
    if (guideMode !== 'playing' || journeyMode !== 'quick') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGuideMode('paused');
      return;
    }
    const timer = window.setTimeout(() => {
      const current = normalizePublicBusinessState(normalizeTourStateFromSearchParams(new URLSearchParams(window.location.search), historyState));
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
  }, [guideMode, historyState, journeyMode, locale, replacePresentedState]);

  const adaptedCopy: PublicProductExperienceCopy = {
    ...copy,
    explorer: {
      ...copy.explorer,
      connect: ui.explorer.connect,
      deal: {
        ...copy.explorer.deal,
        statusLabel: presentation.contextLabel,
        status: presentation.context,
        noBlocker: presentation.noBlocker,
      },
      controls: { ...copy.explorer.controls, lens: ui.explorer.lensLabel, perspective: ui.explorer.roleLabel, scenario: ui.explorer.scenarioLabel, startGuide: ui.explorer.startGuide },
      stages: {
        ...copy.explorer.stages,
        logistics: { ...copy.explorer.stages.logistics, action: presentation.logisticsAction },
        documents: { ...copy.explorer.stages.documents, next: presentation.documentsNext },
      },
      perspectives: {
        ...copy.explorer.perspectives,
        seller: { ...copy.explorer.perspectives.seller, value: presentation.sellerValue, outcome: presentation.sellerOutcome },
        elevator: { ...copy.explorer.perspectives.elevator, value: presentation.elevatorValue, documents: presentation.elevatorDocuments },
        operator: { ...copy.explorer.perspectives.operator, documents: presentation.operatorDocuments },
      },
      scenarios: {
        standard: { ...copy.explorer.scenarios.standard, label: ui.explorer.scenarios.standard },
        partial: { ...copy.explorer.scenarios.partial, label: ui.explorer.scenarios.partial },
        dispute: { ...copy.explorer.scenarios.dispute, label: ui.explorer.scenarios.dispute },
      },
      documents: copy.explorer.documents.map((document, index) => ({
        ...document,
        status: presentation.documentContexts[index] ?? presentation.documentContexts[presentation.documentContexts.length - 1],
      })),
      risks: {
        ...copy.explorer.risks,
        qualityDeviation: { ...copy.explorer.risks.qualityDeviation, blocked: presentation.qualityDeviationBlocked },
        missingDocument: { ...copy.explorer.risks.missingDocument, blocked: presentation.missingDocumentBlocked },
      },
    },
  };

  const currentStageIndex = Math.max(0, TOUR_STAGES.indexOf(historyState.stage));
  const currentStage = adaptedCopy.explorer.stages[historyState.stage];
  const currentPublicPerspective = publicPerspectiveKey(historyState.perspective);
  const currentPerspective = adaptedCopy.explorer.perspectives[currentPublicPerspective];
  const currentScenario = adaptedCopy.explorer.scenarios[historyState.scenario];
  const nextStageKey = TOUR_STAGES[currentStageIndex + 1];
  const activeForVisitor = ACTIVE_PERSPECTIVES_BY_STAGE[historyState.stage].includes(historyState.perspective);
  const visitorAction = STAFF_PERSPECTIVES.has(historyState.perspective)
    ? currentPerspective.action
    : activeForVisitor ? currentStage.action : journey.labels.noAction;
  const scenarioRisk = journey.scenarios[historyState.scenario].risk;
  const deal = adaptedCopy.explorer.deal;

  const readPresentedState = () => normalizePublicBusinessState(normalizeTourStateFromSearchParams(new URLSearchParams(window.location.search), historyState));

  const selectIntent = (intent: DealJourneyIntent) => {
    const perspective = journey.intents[intent].perspective as TourPerspective;
    const next = { ...readPresentedState(), perspective, lens: 'execution' as const, stage: 'terms' as const };
    setSelectedIntent(intent);
    setJourneyMode('quick');
    setGuideMode('idle');
    presentState(next, 'push', { intent, view: 'quick' });
    emitMobileSelection('perspective_selected', locale, next, 'public_v5_intent');
  };

  const selectMobilePerspective = (perspective: TourPerspective) => {
    const next = { ...readPresentedState(), perspective };
    setSelectedIntent('other');
    presentState(next, 'push', { intent: 'other' });
    emitMobileSelection('perspective_selected', locale, next);
  };

  const selectMobileScenario = (scenario: TourScenario) => {
    const next = { ...readPresentedState(), scenario };
    pushPresentedState(next);
    emitMobileSelection('scenario_selected', locale, next);
  };

  const selectStage = (stage: TourStage, historyMode: 'push' | 'replace' = 'push') => {
    const next = { ...readPresentedState(), stage };
    presentState(next, historyMode);
    window.dispatchEvent(new CustomEvent('pc:public-product-analytics', { detail: { name: 'stage_selected', locale, perspective: next.perspective, stage, scenario: next.scenario, source: 'public_v5_quick_journey' } }));
  };

  const setMode = (mode: JourneyMode) => {
    setGuideMode('idle');
    setJourneyMode(mode);
    presentState(readPresentedState(), 'push', { view: mode });
  };

  const startGuide = () => {
    const current = readPresentedState();
    const first = { ...current, stage: 'terms' as const };
    replacePresentedState(first);
    setGuideMode('playing');
    emitGuideEvent('guided_tour_started', locale, first);
  };

  const openTai = (selectedPrompt: string) => {
    const prompts = journey.taiPrompts[historyState.stage];
    const ordered = [selectedPrompt, ...prompts.filter((prompt) => prompt !== selectedPrompt)];
    window.dispatchEvent(new CustomEvent('pc:public-assistant-context', { detail: { context: `deal-${historyState.stage}`, prompts: ordered } }));
    window.dispatchEvent(new CustomEvent('pc:public-product-analytics', { detail: { name: 'tai_stage_prompt_opened', locale, perspective: historyState.perspective, stage: historyState.stage, scenario: historyState.scenario, source: 'public_v5_quick_journey' } }));
  };

  const clearIntent = () => {
    setGuideMode('idle');
    setSelectedIntent(null);
    setJourneyMode('quick');
    presentState(readPresentedState(), 'push', { intent: null, view: 'quick' });
  };

  return (
    <div className='pc-ppe-v4-explorer pc-ppe-v5-journey'>
      <style jsx global>{`
        .pc-ppe-v5-detailed .pc-ppe-lens-list > button:nth-child(2),
        .pc-ppe-v5-detailed .pc-ppe-lens-list > button:nth-child(6) { display: none; }
        @media (max-width: 720px) {
          .pc-ppe-v5-detailed .pc-ppe-explorer-grid { grid-template-areas:\n              'lenses'\n              'main'\n              'context'; }
          .pc-ppe-v5-detailed .pc-ppe-context-panel .pc-ppe-select-label { display: none; }
        }
      `}</style>

      {!selectedIntent ? (
        <section className='pc-ppe-v5-intent pc-ppe-v5-surface' aria-labelledby='pc-ppe-v5-intent-title'>
          <header className='pc-ppe-v5-intent-head'>
            <span className='pc-ppe-v5-control-label'>{journey.labels.roleContext}</span>
            <h2 id='pc-ppe-v5-intent-title'>{journey.labels.intentQuestion}</h2>
            <p>{journey.labels.intentLead}</p>
          </header>
          <div className='pc-ppe-v5-intent-grid' role='group' aria-labelledby='pc-ppe-v5-intent-title'>
            {DEAL_JOURNEY_INTENTS.map((intent) => {
              const option = journey.intents[intent];
              return (
                <button key={intent} type='button' className='pc-ppe-v5-intent-option' onClick={() => selectIntent(intent)}>
                  <span className='pc-ppe-v5-intent-icon'><PublicExperienceIcon name={option.perspective as TourPerspective} size={22} /></span>
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                  <PublicExperienceIcon name='arrow' size={18} />
                </button>
              );
            })}
          </div>
          <details className='pc-ppe-v5-other-role'>
            <summary>{journey.labels.otherParticipant}<PublicExperienceIcon name='arrow' size={18} /></summary>
            <label>
              <span>{journey.labels.chooseParticipant}</span>
              <select value={currentPublicPerspective} onChange={(event) => selectMobilePerspective(event.target.value as TourPerspective)}>
                {PUBLIC_PERSPECTIVES.map((key) => <option key={key} value={key}>{adaptedCopy.explorer.perspectives[key].label}</option>)}
              </select>
            </label>
          </details>
        </section>
      ) : (
        <>
          <section className='pc-ppe-v5-controls'>
            <div className='pc-ppe-v5-context-row'>
              <span className='pc-ppe-v5-context-chip'><PublicExperienceIcon name={currentPublicPerspective} size={16} />{selectedIntent === 'other' ? currentPerspective.label : journey.intents[selectedIntent].label}</span>
              <button type='button' className='pc-ppe-v5-change' onClick={clearIntent}>{journey.labels.changeIntent}</button>
            </div>
            <div className='pc-ppe-v5-mode-switch' role='group' aria-label={journey.labels.detailedMode}>
              <button type='button' data-active={journeyMode === 'quick' ? 'true' : 'false'} aria-pressed={journeyMode === 'quick'} onClick={() => setMode('quick')}>{journey.labels.quickMode}</button>
              <button type='button' data-active={journeyMode === 'detailed' ? 'true' : 'false'} aria-pressed={journeyMode === 'detailed'} onClick={() => setMode('detailed')}>{journey.labels.detailedMode}</button>
            </div>
            <div className='pc-ppe-v5-mode-notes' aria-hidden='true'><p>{journey.labels.quickModeNote}</p><p>{journey.labels.detailedModeNote}</p></div>
            <div className='pc-ppe-v5-scenario pc-ppe-v5-surface'>
              <span className='pc-ppe-v5-control-label'>{journey.labels.scenarioQuestion}</span>
              <div className='pc-ppe-v5-scenario-grid pc-ppe-v4-mobile-scenario-list' role='group' aria-label={journey.labels.scenarioQuestion}>
                {TOUR_SCENARIOS.map((key) => <button key={key} type='button' aria-pressed={historyState.scenario === key} data-active={historyState.scenario === key ? 'true' : 'false'} onClick={() => selectMobileScenario(key)}>{journey.scenarios[key].label}</button>)}
              </div>
              <p className='pc-ppe-v5-formal-scenario'>{journey.labels.formalScenario}: {currentScenario.label}</p>
            </div>
          </section>

          <div className='pc-ppe-v5-deal-strip' data-testid='public-deal-journey-context'>
            <div className='pc-ppe-v5-deal-strip-top'><strong>{journey.labels.yourDeal}</strong><span className='pc-ppe-v5-demo-badge'>{journey.labels.demonstration}</span></div>
            <div className='pc-ppe-v5-deal-summary'><strong>{deal.commodity} · {deal.volume}</strong><span>{deal.route}</span><span>{currentPerspective.label}</span></div>
          </div>

          {journeyMode === 'quick' ? (
            <>
              <section className='pc-ppe-v5-stage-card pc-ppe-v5-surface' data-testid='public-deal-quick-stage'>
                <div className='pc-ppe-v5-stage-heading'>
                  <div className='pc-ppe-v5-stage-counter'><span>{journey.labels.stage} {currentStageIndex + 1} {journey.labels.of} {TOUR_STAGES.length}</span><span>{currentPerspective.label}</span></div>
                  <progress className='pc-ppe-v5-stage-progress' value={currentStageIndex + 1} max={TOUR_STAGES.length} aria-label={currentStage.label} />
                </div>
                <div className='pc-ppe-v5-stage-main'><span className='pc-ppe-v5-actor'><PublicExperienceIcon name={stageIcon(historyState.stage)} size={16} />{journey.labels.nowActs}: {currentStage.owner}</span><h2>{currentStage.label}</h2><p>{deal.status}</p></div>
                <div className='pc-ppe-v5-stage-core'>
                  <article><span>{journey.labels.whatHappened}</span><strong>{currentStage.happened}</strong></article>
                  <article data-priority='true'><span>{journey.labels.yourAction}</span><strong>{visitorAction}</strong></article>
                  <article><span>{journey.labels.platformAction}</span><strong>{journey.platformActionByStage[historyState.stage]}</strong></article>
                </div>
                <div className='pc-ppe-v5-state-grid'>
                  <article><header><PublicExperienceIcon name='money' size={16} />{journey.labels.money}</header><p>{journey.moneyByStage[historyState.stage]}</p></article>
                  <article><header><PublicExperienceIcon name='documents' size={16} />{journey.labels.documents}</header><p>{journey.documentsByStage[historyState.stage]}</p></article>
                  <article data-tone='risk'><header><PublicExperienceIcon name='risk' size={16} />{journey.labels.risk}</header><p>{scenarioRisk}</p></article>
                </div>
                <div className='pc-ppe-v5-next'><span>{journey.labels.next}</span><strong>{nextStageKey ? adaptedCopy.explorer.stages[nextStageKey].label : journey.labels.completeTitle}</strong></div>
                <div className='pc-ppe-v5-tai'>
                  <div className='pc-ppe-v5-tai-head'><PublicExperienceIcon name='intelligence' size={20} /><strong>{journey.labels.askTai}</strong></div>
                  <div className='pc-ppe-v5-tai-prompts'>{journey.taiPrompts[historyState.stage].map((prompt) => <button key={prompt} type='button' className='pc-ppe-v5-tai-button' onClick={() => openTai(prompt)}>{prompt}</button>)}</div>
                </div>
                <div className='pc-ppe-v5-stage-nav'>
                  <button type='button' className='secondary' disabled={currentStageIndex === 0} onClick={() => selectStage(TOUR_STAGES[Math.max(0, currentStageIndex - 1)] ?? 'terms')}>{journey.labels.previous}</button>
                  <button type='button' className='primary' disabled={!nextStageKey} onClick={() => nextStageKey && selectStage(nextStageKey)}>{journey.labels.nextStage}</button>
                </div>
                <div className='pc-ppe-v5-playback'>
                  {guideMode === 'idle' ? <button type='button' data-primary='true' onClick={startGuide}><PublicExperienceIcon name='play' size={16} /> {journey.labels.startQuick}</button> : <><button type='button' data-primary='true' onClick={() => setGuideMode((mode) => mode === 'playing' ? 'paused' : 'playing')}><PublicExperienceIcon name={guideMode === 'playing' ? 'pause' : 'play'} size={16} /> {guideMode === 'playing' ? journey.labels.pause : journey.labels.continue}</button><button type='button' onClick={() => setGuideMode('idle')}>{journey.labels.stop}</button></>}
                  <button type='button' onClick={() => { setGuideMode('idle'); selectStage('terms', 'replace'); }}>{journey.labels.restart}</button>
                </div>
              </section>

              <div className='pc-ppe-v5-stage-rail-wrap'>
                <span className='pc-ppe-v5-control-label'>{adaptedCopy.explorer.controls.stage}</span>
                <div className='pc-ppe-v5-stage-rail' role='group' aria-label={adaptedCopy.explorer.controls.stage}>
                  {TOUR_STAGES.map((stageKey, index) => <button key={stageKey} type='button' data-state={stageKey === historyState.stage ? 'active' : index < currentStageIndex ? 'complete' : 'pending'} aria-current={stageKey === historyState.stage ? 'step' : undefined} onClick={() => selectStage(stageKey)}>{index + 1}. {adaptedCopy.explorer.stages[stageKey].label}</button>)}
                </div>
              </div>

              {historyState.stage === 'closure' ? (
                <section className='pc-ppe-v5-complete pc-ppe-v5-surface' aria-labelledby='pc-ppe-v5-complete-title'>
                  <h2 id='pc-ppe-v5-complete-title'>{journey.labels.completeTitle}</h2><p>{journey.labels.completeLead}</p>
                  <ul className='pc-ppe-v5-result-list'>{journey.finalChecks.map((item) => <li key={item}><i>✓</i><span>{item}</span></li>)}</ul>
                  <div className='pc-ppe-v5-one-contour'>{journey.labels.oneContour}</div>
                  <div className='pc-ppe-v5-complete-actions'>
                    <a href={registerHref} className='pc-ppe-primary-button' onClick={() => window.dispatchEvent(new CustomEvent('pc:public-product-analytics', { detail: { name: 'connect_cta_click', locale, source: 'public_v5_complete' } }))}>{ui.explorer.connect}<PublicExperienceIcon name='arrow' size={18} /></a>
                    <button type='button' onClick={() => { selectMobileScenario(historyState.scenario === 'standard' ? 'partial' : historyState.scenario === 'partial' ? 'dispute' : 'standard'); selectStage('terms', 'replace'); }}>{journey.labels.anotherScenario}</button>
                  </div>
                </section>
              ) : null}

              <section className='pc-ppe-v5-compare' aria-label={journey.labels.afterTitle}>
                <article><h3>{journey.labels.beforeTitle}</h3><ul>{journey.before.map((item) => <li key={item}>{item}</li>)}</ul></article>
                <article data-positive='true'><h3>{journey.labels.afterTitle}</h3><ul>{journey.after.map((item) => <li key={item}>{item}</li>)}</ul></article>
              </section>
              <button type='button' className='pc-ppe-secondary-button' onClick={() => setMode('detailed')}>{journey.labels.detailedOpen}</button>
            </>
          ) : (
            <section className='pc-ppe-v5-detailed' data-testid='public-deal-detailed-mode'>
              <div className='pc-ppe-v5-detailed-intro'><strong>{journey.labels.detailedMode}</strong><p>{journey.labels.detailedModeNote}</p><button type='button' className='pc-ppe-text-button' onClick={() => setMode('quick')}>{journey.labels.detailedBack}</button></div>
              <PublicDealExplorer key={historyRevision} copy={adaptedCopy} locale={locale} initialState={historyState} />
            </section>
          )}
        </>
      )}
    </div>
  );
}