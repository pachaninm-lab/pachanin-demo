#!/usr/bin/env node
import { readFileSync } from 'node:fs';

export function selectTaiOwnerPreflightRun(report, targetSha) {
  if (!/^[0-9a-f]{40}$/u.test(targetSha)) {
    throw new Error('Invalid exact target SHA.');
  }
  const runs = Array.isArray(report?.workflow_runs) ? report.workflow_runs : [];
  const matches = runs.filter((run) =>
    run?.name === 'TAI Owner REG.RU Preflight'
    && run?.head_sha === targetSha
    && run?.status === 'completed'
    && run?.conclusion === 'success'
    && Number.isSafeInteger(run?.id)
    && run.id > 0
    && Number.isSafeInteger(run?.run_attempt)
    && run.run_attempt > 0
  );
  if (matches.length < 1) {
    throw new Error('No successful exact-SHA owner preflight run found.');
  }
  matches.sort((left, right) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || '') || 0;
    const rightTime = Date.parse(right.updated_at || right.created_at || '') || 0;
    return rightTime - leftTime || right.id - left.id;
  });
  return Object.freeze({ id: matches[0].id, runAttempt: matches[0].run_attempt });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [path, targetSha] = process.argv.slice(2);
  if (!path || !targetSha) {
    console.error('Usage: select-tai-owner-preflight-run.mjs <runs.json> <exact-sha>');
    process.exit(64);
  }
  try {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    const selected = selectTaiOwnerPreflightRun(report, targetSha);
    process.stdout.write(`${selected.id} ${selected.runAttempt}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
