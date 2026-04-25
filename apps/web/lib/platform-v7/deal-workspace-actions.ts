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

export interface PlatformV7DealWorkspaceAction {
  id: PlatformV7DealWorkspaceActionId;
  label: string;
  kind: PlatformV7DealWorkspaceActionKind;
  tone: 'neutral' | 'success' | 'danger';
  href?: string;
}

export const PLATFORM_V7_DEAL_WORKSPACE_ACTIONS: PlatformV7DealWorkspaceAction[] = [
  { id: 'request-release', label: 'Запросить выпуск денег', kind: 'primary', tone: 'success' },
  { id: 'release-funds', label: 'Выпустить деньги', kind: 'primary', tone: 'success' },
  { id: 'start-documents', label: 'Начать сбор документов', kind: 'secondary', tone: 'neutral' },
  { id: 'complete-documents', label: 'Документы собраны', kind: 'secondary', tone: 'success' },
  { id: 'open-dispute', label: 'Открыть спор', kind: 'secondary', tone: 'danger' },
  { id: 'resolve-dispute', label: 'Закрыть спор', kind: 'secondary', tone: 'success' },
  { id: 'open-bank', label: 'Банк', kind: 'tertiary', tone: 'neutral', href: '/platform-v7/bank' },
  { id: 'open-disputes', label: 'Споры', kind: 'tertiary', tone: 'neutral', href: '/platform-v7/disputes' },
];

export interface PlatformV7DealWorkspaceActionPlan {
  primary: PlatformV7DealWorkspaceAction[];
  secondary: PlatformV7DealWorkspaceAction[];
  tertiary: PlatformV7DealWorkspaceAction[];
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
