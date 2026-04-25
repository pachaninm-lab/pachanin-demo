import {
  platformV7DemoTourDurationMs,
  platformV7DemoTourStepById,
  platformV7DemoTourSteps,
  type PlatformV7DemoTourStep,
  type PlatformV7DemoTourStepId,
} from './demo-tour';

export interface PlatformV7DemoTourPosition {
  step: PlatformV7DemoTourStep;
  stepIndex: number;
  elapsedMs: number;
  stepElapsedMs: number;
  progress: number;
  isComplete: boolean;
}

export function clampPlatformV7DemoTourElapsed(elapsedMs: number): number {
  return Math.min(Math.max(0, elapsedMs), platformV7DemoTourDurationMs());
}

export function platformV7DemoTourPosition(elapsedMs: number): PlatformV7DemoTourPosition {
  const steps = platformV7DemoTourSteps();
  const safeElapsed = clampPlatformV7DemoTourElapsed(elapsedMs);
  const duration = platformV7DemoTourDurationMs();
  let cursor = 0;

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const nextCursor = cursor + step.durationMs;
    if (safeElapsed < nextCursor || index === steps.length - 1) {
      return {
        step,
        stepIndex: index,
        elapsedMs: safeElapsed,
        stepElapsedMs: Math.max(0, safeElapsed - cursor),
        progress: duration === 0 ? 1 : Number((safeElapsed / duration).toFixed(4)),
        isComplete: safeElapsed >= duration,
      };
    }
    cursor = nextCursor;
  }

  const fallback = steps[steps.length - 1]!;
  return {
    step: fallback,
    stepIndex: steps.length - 1,
    elapsedMs: duration,
    stepElapsedMs: fallback.durationMs,
    progress: 1,
    isComplete: true,
  };
}

export function platformV7DemoTourElapsedForStep(id: PlatformV7DemoTourStepId): number {
  const steps = platformV7DemoTourSteps();
  let elapsed = 0;
  for (const step of steps) {
    if (step.id === id) return elapsed;
    elapsed += step.durationMs;
  }
  return 0;
}

export function platformV7DemoTourNextStep(id: PlatformV7DemoTourStepId): PlatformV7DemoTourStep | null {
  const steps = platformV7DemoTourSteps();
  const index = steps.findIndex((step) => step.id === id);
  return index >= 0 ? steps[index + 1] ?? null : null;
}

export function platformV7DemoTourPreviousStep(id: PlatformV7DemoTourStepId): PlatformV7DemoTourStep | null {
  const steps = platformV7DemoTourSteps();
  const index = steps.findIndex((step) => step.id === id);
  return index > 0 ? steps[index - 1] ?? null : null;
}

export function platformV7DemoTourCanJumpTo(id: string): id is PlatformV7DemoTourStepId {
  return platformV7DemoTourStepById(id as PlatformV7DemoTourStepId) !== null;
}
