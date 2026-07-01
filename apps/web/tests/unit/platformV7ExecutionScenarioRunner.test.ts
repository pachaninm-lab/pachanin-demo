import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const runnerSource = fs.readFileSync(
  path.join(process.cwd(), 'packages/domain-core/src/execution-simulation/scenario-runner.ts'),
  'utf8',
);

describe('platform-v7 execution scenario runner', () => {
  it('keeps the runner tied to real domain actions before close', () => {
    for (const term of ['runPlatformAction', 'createLot', 'publishLot', 'createDeal']) {
      expect(runnerSource).toContain(term);
    }
  });

  it('keeps close as a target, not a fake completed fact', () => {
    expect(runnerSource).toContain("targetFinalStatus: 'CLOSED'");
    expect(runnerSource).toContain('closeReady: false');
  });

  it('keeps audit and timeline counters sourced from scenario state', () => {
    expect(runnerSource).toContain('auditEventCountDelta: scenarioState.auditEvents.length');
    expect(runnerSource).toContain('timelineEventCountDelta: scenarioState.dealTimeline.length');
  });
});
