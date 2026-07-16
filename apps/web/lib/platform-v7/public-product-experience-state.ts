export const TOUR_ENTRY_VARIANTS = ['role', 'problem', 'deal'] as const;

export const TOUR_LENSES = [
  'execution',
  'participants',
  'documents',
  'money',
  'risk',
  'intelligence',
] as const;

export const TOUR_STAGES = [
  'terms',
  'admission',
  'auction',
  'deal',
  'logistics',
  'acceptance',
  'laboratory',
  'documents',
  'settlement',
  'closure',
] as const;

export const TOUR_SCENARIOS = ['standard', 'partial', 'dispute'] as const;

export const TOUR_PERSPECTIVES = [
  'seller',
  'buyer',
  'logistics',
  'driver',
  'elevator',
  'lab',
  'surveyor',
  'bank',
  'operator',
  'compliance',
  'arbitrator',
  'executive',
] as const;

export const TOUR_RISKS = [
  'transportDelay',
  'weightMismatch',
  'qualityDeviation',
  'missingDocument',
  'documentVersion',
  'paymentBasis',
] as const;

export type TourEntryVariant = (typeof TOUR_ENTRY_VARIANTS)[number];
export type TourLens = (typeof TOUR_LENSES)[number];
export type TourStage = (typeof TOUR_STAGES)[number];
export type TourScenario = (typeof TOUR_SCENARIOS)[number];
export type TourPerspective = (typeof TOUR_PERSPECTIVES)[number];
export type TourRisk = (typeof TOUR_RISKS)[number];

export type TourState = {
  lens: TourLens;
  stage: TourStage;
  scenario: TourScenario;
  perspective: TourPerspective;
  risk: TourRisk;
  aiEnabled: boolean;
};

export type TourEvent =
  | { type: 'select-lens'; lens: TourLens }
  | { type: 'select-stage'; stage: TourStage }
  | { type: 'select-scenario'; scenario: TourScenario }
  | { type: 'select-perspective'; perspective: TourPerspective }
  | { type: 'select-risk'; risk: TourRisk }
  | { type: 'set-ai'; enabled: boolean }
  | { type: 'next-stage' }
  | { type: 'previous-stage' }
  | { type: 'reset' };

export const DEFAULT_TOUR_STATE: TourState = {
  lens: 'execution',
  stage: 'terms',
  scenario: 'standard',
  perspective: 'buyer',
  risk: 'weightMismatch',
  aiEnabled: false,
};

function includes<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeTourEntryVariant(value: string | string[] | undefined): TourEntryVariant {
  const entry = one(value);
  return includes(TOUR_ENTRY_VARIANTS, entry) ? entry : 'deal';
}

export function normalizeTourState(
  query: Record<string, string | string[] | undefined>,
  fallback: TourState = DEFAULT_TOUR_STATE,
): TourState {
  const lens = one(query.lens);
  const stage = one(query.stage);
  const scenario = one(query.scenario);
  const perspective = one(query.perspective);
  const risk = one(query.risk);
  const ai = one(query.ai);

  return {
    lens: includes(TOUR_LENSES, lens) ? lens : fallback.lens,
    stage: includes(TOUR_STAGES, stage) ? stage : fallback.stage,
    scenario: includes(TOUR_SCENARIOS, scenario) ? scenario : fallback.scenario,
    perspective: includes(TOUR_PERSPECTIVES, perspective) ? perspective : fallback.perspective,
    risk: includes(TOUR_RISKS, risk) ? risk : fallback.risk,
    aiEnabled: ai === '1' ? true : ai === '0' ? false : fallback.aiEnabled,
  };
}

export function normalizeTourStateFromSearchParams(
  params: Pick<URLSearchParams, 'get'>,
  fallback: TourState = DEFAULT_TOUR_STATE,
): TourState {
  return normalizeTourState({
    lens: params.get('lens') ?? undefined,
    stage: params.get('stage') ?? undefined,
    scenario: params.get('scenario') ?? undefined,
    perspective: params.get('perspective') ?? undefined,
    risk: params.get('risk') ?? undefined,
    ai: params.get('ai') ?? undefined,
  }, fallback);
}

export function reduceTourState(state: TourState, event: TourEvent): TourState {
  switch (event.type) {
    case 'select-lens':
      return state.lens === event.lens ? state : { ...state, lens: event.lens };
    case 'select-stage':
      return state.stage === event.stage ? state : { ...state, stage: event.stage };
    case 'select-scenario':
      return state.scenario === event.scenario ? state : { ...state, scenario: event.scenario };
    case 'select-perspective':
      return state.perspective === event.perspective ? state : { ...state, perspective: event.perspective };
    case 'select-risk':
      return state.risk === event.risk ? state : { ...state, risk: event.risk };
    case 'set-ai':
      return state.aiEnabled === event.enabled ? state : { ...state, aiEnabled: event.enabled };
    case 'next-stage': {
      const index = TOUR_STAGES.indexOf(state.stage);
      const stage = TOUR_STAGES[Math.min(index + 1, TOUR_STAGES.length - 1)] ?? state.stage;
      return stage === state.stage ? state : { ...state, stage };
    }
    case 'previous-stage': {
      const index = TOUR_STAGES.indexOf(state.stage);
      const stage = TOUR_STAGES[Math.max(index - 1, 0)] ?? state.stage;
      return stage === state.stage ? state : { ...state, stage };
    }
    case 'reset':
      return DEFAULT_TOUR_STATE;
    default:
      return state;
  }
}

export function writeTourStateToSearchParams(state: TourState, current?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current?.toString());
  params.set('lens', state.lens);
  params.set('stage', state.stage);
  params.set('scenario', state.scenario);
  params.set('perspective', state.perspective);
  params.set('risk', state.risk);
  params.set('ai', state.aiEnabled ? '1' : '0');
  return params;
}
