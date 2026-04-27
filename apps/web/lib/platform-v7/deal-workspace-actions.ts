export type PlatformV7DealWorkspaceActionId =
  | 'request-release'
  | 'release-funds'
  | 'start-documents'
  | 'complete-documents'
  | 'open-dispute'
  | 'resolve-dispute'
  | 'open-bank'
  | 'open-disputes';

export type PlatformV7DealWorkspaceActionKind = 'primary' | 'secondary' | 'tertiary';

export type PlatformV7DealWorkspaceGateId =
  | 'money'
  | 'documents'
  | 'fgis'
  | 'transport'
  | 'quality'
  | 'evidence'
  | 'compliance'
  | 'degradation';

export type PlatformV7DealWorkspaceMaturityMode = 'sandbox' | 'manual' | 'controlled-pilot' | 'live';

export interface PlatformV7DealWorkspaceAction {
  id: PlatformV7DealWorkspaceActionId;
  label: string;
  kind: PlatformV7DealWorkspaceActionKind;
  tone: 'neutral' | 'success' | 'danger';
  href?: string;
  requiredGates: PlatformV7DealWorkspaceGateId[];
  maturityMode: PlatformV7DealWorkspaceMaturityMode;
  irreversible: boolean;
  rollback: string;
}

export interface PlatformV7DealWorkspaceGateState {
  id: PlatformV7DealWorkspaceGateId;
  passed: boolean;
  reason?: string;
}

export interface PlatformV7DealWorkspaceActionGateBlocker {
  gateId: PlatformV7DealWorkspaceGateId;
  label: string;
  reason: string;
}

export interface PlatformV7DealWorkspaceActionEvaluation {
  action: PlatformV7DealWorkspaceAction;
  enabled: boolean;
  blockers: PlatformV7DealWorkspaceActionGateBlocker[];
  maturityMode: PlatformV7DealWorkspaceMaturityMode;
  rollback: string;
}

const GATE_LABELS: Record<PlatformV7DealWorkspaceGateId, string> = {
  money: 'MoneyGate',
  documents: 'DocumentGate',
  fgis: 'FGISGate',
  transport: 'TransportGate',
  quality: 'QualityGate',
  evidence: 'EvidenceGate',
  compliance: 'ComplianceGate',
  degradation: 'DegradationGate',
};

const RELEASE_GATES: PlatformV7DealWorkspaceGateId[] = [
  'money',
  'documents',
  'fgis',
  'transport',
  'quality',
  'evidence',
  'compliance',
  'degradation',
];

export const PLATFORM_V7_DEAL_WORKSPACE_ACTIONS: PlatformV7DealWorkspaceAction[] = [
  {
    id: 'request-release',
    label: 'Запросить выпуск денег',
    kind: 'primary',
    tone: 'success',
    requiredGates: ['money', 'documents', 'transport', 'fgis', 'degradation'],
    maturityMode: 'controlled-pilot',
    irreversible: false,
    rollback: 'Отменить запрос через operator action log до банкового подтверждения.',
  },
  {
    id: 'release-funds',
    label: 'Выпустить деньги',
    kind: 'primary',
    tone: 'success',
    requiredGates: RELEASE_GATES,
    maturityMode: 'controlled-pilot',
    irreversible: true,
    rollback: 'Запретить прямой rollback; только банковая сверка, refund/dispute flow и ручное исключение с audit event.',
  },
  {
    id: 'start-documents',
    label: 'Начать сбор документов',
    kind: 'secondary',
    tone: 'neutral',
    requiredGates: [],
    maturityMode: 'controlled-pilot',
    irreversible: false,
    rollback: 'Закрыть document task через action log без изменения первичных документов.',
  },
  {
    id: 'complete-documents',
    label: 'Документы собраны',
    kind: 'secondary',
    tone: 'success',
    requiredGates: ['documents', 'fgis', 'degradation'],
    maturityMode: 'controlled-pilot',
    irreversible: false,
    rollback: 'Вернуть DocumentGate в review и оставить причину в audit event.',
  },
  {
    id: 'open-dispute',
    label: 'Открыть спор',
    kind: 'secondary',
    tone: 'danger',
    requiredGates: [],
    maturityMode: 'controlled-pilot',
    irreversible: false,
    rollback: 'Закрыть спор только решением dispute workflow; исходное открытие остаётся в журнале.',
  },
  {
    id: 'resolve-dispute',
    label: 'Закрыть спор',
    kind: 'secondary',
    tone: 'success',
    requiredGates: ['evidence', 'quality', 'compliance', 'degradation'],
    maturityMode: 'controlled-pilot',
    irreversible: false,
    rollback: 'Переоткрыть спор корректирующим dispute decision без удаления прошлого решения.',
  },
  {
    id: 'open-bank',
    label: 'Банк',
    kind: 'tertiary',
    tone: 'neutral',
    href: '/platform-v7/bank',
    requiredGates: [],
    maturityMode: 'controlled-pilot',
    irreversible: false,
    rollback: 'Навигационное действие без rollback.',
  },
  {
    id: 'open-disputes',
    label: 'Споры',
    kind: 'tertiary',
    tone: 'neutral',
    href: '/platform-v7/disputes',
    requiredGates: [],
    maturityMode: 'controlled-pilot',
    irreversible: false,
    rollback: 'Навигационное действие без rollback.',
  },
];

export interface PlatformV7DealWorkspaceActionPlan {
  primary: PlatformV7DealWorkspaceAction[];
  secondary: PlatformV7DealWorkspaceAction[];
  tertiary: PlatformV7DealWorkspaceAction[];
}

export interface PlatformV7DealWorkspaceSafeActionPlan {
  primary: PlatformV7DealWorkspaceActionEvaluation[];
  secondary: PlatformV7DealWorkspaceActionEvaluation[];
  tertiary: PlatformV7DealWorkspaceActionEvaluation[];
}

export function platformV7DealWorkspaceActions(): PlatformV7DealWorkspaceAction[] {
  return PLATFORM_V7_DEAL_WORKSPACE_ACTIONS;
}

export function platformV7DealWorkspaceActionById(id: PlatformV7DealWorkspaceActionId): PlatformV7DealWorkspaceAction {
  return PLATFORM_V7_DEAL_WORKSPACE_ACTIONS.find((action) => action.id === id)!;
}

export function platformV7DealWorkspaceActionPlan(
  actionIds: PlatformV7DealWorkspaceActionId[],
): PlatformV7DealWorkspaceActionPlan {
  const actions = actionIds.map(platformV7DealWorkspaceActionById);
  const primary = actions.filter((action) => action.kind === 'primary').slice(0, 1);
  const secondary = actions.filter((action) => action.kind === 'secondary').slice(0, 2);
  const tertiary = actions.filter((action) => action.kind === 'tertiary');

  return { primary, secondary, tertiary };
}

export function platformV7DealWorkspaceActionPlanIsValid(plan: PlatformV7DealWorkspaceActionPlan): boolean {
  return plan.primary.length <= 1 && plan.secondary.length <= 2;
}

export function platformV7DealWorkspaceGateLabel(gateId: PlatformV7DealWorkspaceGateId): string {
  return GATE_LABELS[gateId];
}

export function platformV7DealWorkspaceEvaluateAction(
  actionId: PlatformV7DealWorkspaceActionId,
  gates: PlatformV7DealWorkspaceGateState[],
): PlatformV7DealWorkspaceActionEvaluation {
  const action = platformV7DealWorkspaceActionById(actionId);
  const gateMap = new Map(gates.map((gate) => [gate.id, gate]));
  const blockers = action.requiredGates.flatMap((gateId) => {
    const gate = gateMap.get(gateId);
    if (gate?.passed) return [];

    return [{
      gateId,
      label: GATE_LABELS[gateId],
      reason: gate?.reason ?? `${GATE_LABELS[gateId]} не подтверждён.`,
    } satisfies PlatformV7DealWorkspaceActionGateBlocker];
  });

  return {
    action,
    enabled: blockers.length === 0,
    blockers,
    maturityMode: action.maturityMode,
    rollback: action.rollback,
  };
}

export function platformV7DealWorkspaceSafeActionPlan(
  actionIds: PlatformV7DealWorkspaceActionId[],
  gates: PlatformV7DealWorkspaceGateState[],
): PlatformV7DealWorkspaceSafeActionPlan {
  const evaluations = actionIds.map((id) => platformV7DealWorkspaceEvaluateAction(id, gates));
  const primary = evaluations.filter(({ action }) => action.kind === 'primary').slice(0, 1);
  const secondary = evaluations.filter(({ action }) => action.kind === 'secondary').slice(0, 2);
  const tertiary = evaluations.filter(({ action }) => action.kind === 'tertiary');

  return { primary, secondary, tertiary };
}

export function platformV7DealWorkspaceActionHasFullReleaseGuard(actionId: PlatformV7DealWorkspaceActionId): boolean {
  const action = platformV7DealWorkspaceActionById(actionId);
  return RELEASE_GATES.every((gate) => action.requiredGates.includes(gate));
}
