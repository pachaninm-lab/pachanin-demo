import { platformV7DealWorkspaceActionPlan, type PlatformV7DealWorkspaceActionId, type PlatformV7DealWorkspaceActionPlan } from './deal-workspace-actions';
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
}

export interface PlatformV7DealWorkspaceSidePanelModel {
  nextOwner: PlatformV7DealWorkspaceNextOwner;
  actions: PlatformV7DealWorkspaceActionPlan;
  timeline: PlatformV7DealTimelineEvent[];
  timelineCount: number;
  layout: 'desktop-sidepanel-mobile-bottom-sheet';
}

export function platformV7DealWorkspaceSidePanelModel(
  input: PlatformV7DealWorkspaceSidePanelInput,
): PlatformV7DealWorkspaceSidePanelModel {
  const timeline = filterPlatformV7DealTimeline(input.timeline, input.timelineFilter ?? {});

  return {
    nextOwner: input.nextOwner,
    actions: platformV7DealWorkspaceActionPlan(input.actionIds),
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
  return model.actions.primary.length <= 1 && model.actions.secondary.length <= 2;
}
