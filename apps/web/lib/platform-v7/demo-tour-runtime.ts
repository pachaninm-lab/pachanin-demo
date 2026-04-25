import { platformV7DemoTourPosition } from './demo-tour-controller';
import type { PlatformV7DemoTourStepId } from './demo-tour';

export type PlatformV7DemoTourRuntimeStatus = 'idle' | 'playing' | 'paused' | 'complete';

export interface PlatformV7DemoTourRuntimeState {
  status: PlatformV7DemoTourRuntimeStatus;
  elapsedMs: number;
}

export interface PlatformV7DemoTourRuntimeView extends PlatformV7DemoTourRuntimeState {
  activeStepId: PlatformV7DemoTourStepId;
  route: string;
  title: string;
  narration: string;
  progress: number;
  isComplete: boolean;
}

export const PLATFORM_V7_DEMO_TOUR_INITIAL_STATE: PlatformV7DemoTourRuntimeState = {
  status: 'idle',
  elapsedMs: 0,
};

export function platformV7DemoTourPlay(state: PlatformV7DemoTourRuntimeState): PlatformV7DemoTourRuntimeState {
  return { ...state, status: state.status === 'complete' ? 'complete' : 'playing' };
}

export function platformV7DemoTourPause(state: PlatformV7DemoTourRuntimeState): PlatformV7DemoTourRuntimeState {
  return { ...state, status: state.status === 'complete' ? 'complete' : 'paused' };
}

export function platformV7DemoTourSeek(state: PlatformV7DemoTourRuntimeState, elapsedMs: number): PlatformV7DemoTourRuntimeState {
  const position = platformV7DemoTourPosition(elapsedMs);
  return {
    status: position.isComplete ? 'complete' : state.status,
    elapsedMs: position.elapsedMs,
  };
}

export function platformV7DemoTourTick(
  state: PlatformV7DemoTourRuntimeState,
  deltaMs: number,
): PlatformV7DemoTourRuntimeState {
  if (state.status !== 'playing') return state;
  return platformV7DemoTourSeek(state, state.elapsedMs + Math.max(0, deltaMs));
}

export function platformV7DemoTourView(state: PlatformV7DemoTourRuntimeState): PlatformV7DemoTourRuntimeView {
  const position = platformV7DemoTourPosition(state.elapsedMs);
  return {
    ...state,
    elapsedMs: position.elapsedMs,
    status: position.isComplete ? 'complete' : state.status,
    activeStepId: position.step.id,
    route: position.step.route,
    title: position.step.title,
    narration: position.step.narration,
    progress: position.progress,
    isComplete: position.isComplete,
  };
}
