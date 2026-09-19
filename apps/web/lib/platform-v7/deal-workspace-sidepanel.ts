import {
  platformV7DealWorkspaceActionPlan,
  platformV7DealWorkspaceSafeActionPlan,
  type PlatformV7DealWorkspaceActionId,
  type PlatformV7DealWorkspaceActionPlan,
  type PlatformV7DealWorkspaceGateState,
  type PlatformV7DealWorkspaceSafeActionPlan,
} from './deal-workspace-actions';
import { filterPlatformV7DealTimeline, type PlatformV7DealTimelineEvent, type PlatformV7DealTimelineFilter } from './deal-workspace-timeline';

export interface PlatformV7DealWorkspaceNextOwner {
  role: string;
  label: string;
  slaDeadline?: string;
  critical: boolean;
}

export interface PlatformV7DealWorkspaceSidePanelInput {
  nextOwner: PlatformV7DealWorkspaceNextOwner;
  actionIds: PlatformV7DealWorkspaceActionId[];
  timeline: PlatformV7DealTimelineEvent[];
  timelineFilter?: PlatformV7DealTimelineFilter;
  gateStates?: PlatformV7DealWorkspaceGateState[];
}

export interface PlatformV7DealWorkspaceReleaseGuardSummary {
  enabled: boolean;
  blockerCount: number;
  blockerLabels: string[];
  maturityMode: 'not-requested' | 'controlled-pilot';
}

export interface PlatformV7DealWorkspaceSidePanelModel {
  nextOwner: PlatformV7DealWorkspaceNextOwner;
  actions: PlatformV7DealWorkspaceActionPlan;
  safeActions: PlatformV7DealWorkspaceSafeActionPlan | null;
  releaseGuard: PlatformV7DealWorkspaceReleaseGuardSummary;
  timeline: PlatformV7DealTimelineEvent[];
  timelineCount: number;
  layout: 'desktop-sidepanel-mobile-bottom-sheet';
}

export function platformV7DealWorkspaceSidePanelModel(
  input: PlatformV7DealWorkspaceSidePanelInput,
): PlatformV7DealWorkspaceSidePanelModel {
  const timeline = filterPlatformV7DealTimeline(input.timeline, input.timelineFilter ?? {});
  const actions = platformV7DealWorkspaceActionPlan(input.actionIds);
  const safeActions = input.gateStates ? platformV7DealWorkspaceSafeActionPlan(input.actionIds, input.gateStates) : null;
  const releaseAction = safeActions
    ? [...safeActions.primary, ...safeActions.secondary, ...safeActions.tertiary].find(({ action }) => action.id === 'release-funds')
    : null;

  return {
    nextOwner: input.nextOwner,
    actions,
    safeActions,
    releaseGuard: releaseAction
      ? {
        enabled: releaseAction.enabled,
        blockerCount: releaseAction.blockers.length,
        blockerLabels: releaseAction.blockers.map((blocker) => blocker.label),
        maturityMode: 'controlled-pilot',
      }
      : {
        enabled: false,
        blockerCount: 0,
        blockerLabels: [],
        maturityMode: 'not-requested',
      },
    timeline,
    timelineCount: timeline.length,
    layout: 'desktop-sidepanel-mobile-bottom-sheet',
  };
}

export function platformV7DealWorkspaceNextOwnerTone(
  nextOwner: PlatformV7DealWorkspaceNextOwner,
): 'danger' | 'warning' | 'neutral' {
  if (nextOwner.critical) return 'danger';
  if (nextOwner.slaDeadline) return 'warning';
  return 'neutral';
}

export function platformV7DealWorkspaceSidePanelIsValid(model: PlatformV7DealWorkspaceSidePanelModel): boolean {
  const safeActionsValid = model.safeActions
    ? model.safeActions.primary.length <= 1 && model.safeActions.secondary.length <= 2
    : true;

  return model.actions.primary.length <= 1 && model.actions.secondary.length <= 2 && safeActionsValid;
}
