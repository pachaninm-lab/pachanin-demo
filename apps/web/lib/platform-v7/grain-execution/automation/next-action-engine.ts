import type { EntityId, NextAction, UserRole } from '../types';

let actionCounter = 0;

export function createNextAction(params: {
  readonly title: string;
  readonly description?: string;
  readonly role: UserRole;
  readonly priority?: NextAction['priority'];
  readonly actionType: NextAction['actionType'];
  readonly targetRoute: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly createsAuditEvent?: boolean;
  readonly requiresReason?: boolean;
  readonly seed?: EntityId;
}): NextAction {
  actionCounter += 1;
  return {
    id: `NA-${params.seed ?? actionCounter}`,
    title: params.title,
    description: params.description,
    role: params.role,
    priority: params.priority ?? 'medium',
    actionType: params.actionType,
    targetRoute: params.targetRoute,
    disabled: params.disabled,
    disabledReason: params.disabledReason,
    createsAuditEvent: params.createsAuditEvent ?? true,
    requiresReason: params.requiresReason ?? false,
  };
}

export function sortNextActions(actions: NextAction[]): NextAction[] {
  const weight: Record<NextAction['priority'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...actions].sort((a, b) => weight[a.priority] - weight[b.priority]);
}
