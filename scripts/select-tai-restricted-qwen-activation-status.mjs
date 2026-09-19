#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const STATUS_CONTEXT = 'TAI Restricted Qwen REG.RU Activation';

function parseRunId(targetUrl, repositoryFullName) {
  if (typeof targetUrl !== 'string' || targetUrl.length > 2048) {
    throw new Error('Activation status target URL is missing or invalid.');
  }
  let url;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new Error('Activation status target URL is malformed.');
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.search || url.hash) {
    throw new Error('Activation status target URL is outside canonical GitHub Actions authority.');
  }
  const escapedRepository = repositoryFullName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = url.pathname.match(new RegExp(`^/${escapedRepository}/actions/runs/([1-9][0-9]*)/?$`, 'u'));
  if (!match) {
    throw new Error('Activation status target URL does not identify a run in this repository.');
  }
  const runId = Number(match[1]);
  if (!Number.isSafeInteger(runId) || runId < 1) {
    throw new Error('Activation status run ID is invalid.');
  }
  return runId;
}

export function selectTaiRestrictedQwenActivationStatus(report, targetSha, repositoryFullName) {
  if (!/^[0-9a-f]{40}$/u.test(targetSha)) throw new Error('Invalid exact target SHA.');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repositoryFullName)) {
    throw new Error('Invalid repository authority.');
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Malformed combined status report.');
  }
  if (report.sha !== targetSha) {
    throw new Error('Combined status report is not bound to exact current main.');
  }
  const statuses = Array.isArray(report.statuses) ? report.statuses : [];
  const matching = statuses
    .filter((status) => status?.context === STATUS_CONTEXT)
    .sort((left, right) => {
      const leftTime = Date.parse(left?.updated_at || left?.created_at || '') || 0;
      const rightTime = Date.parse(right?.updated_at || right?.created_at || '') || 0;
      const leftId = Number.isSafeInteger(left?.id) ? left.id : 0;
      const rightId = Number.isSafeInteger(right?.id) ? right.id : 0;
      return rightTime - leftTime || rightId - leftId;
    });
  if (matching.length < 1) throw new Error(`Exact commit status ${STATUS_CONTEXT} is missing.`);
  const latest = matching[0];
  if (latest.state !== 'success') {
    throw new Error(`Latest exact commit status ${STATUS_CONTEXT} is not successful.`);
  }
  return Object.freeze({ runId: parseRunId(latest.target_url, repositoryFullName), context: STATUS_CONTEXT });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [path, targetSha, repositoryFullName] = process.argv.slice(2);
  if (!path || !targetSha || !repositoryFullName) {
    console.error('Usage: select-tai-restricted-qwen-activation-status.mjs <status.json> <exact-sha> <owner/repo>');
    process.exit(64);
  }
  try {
    const report = JSON.parse(readFileSync(path, 'utf8'));
    const selected = selectTaiRestrictedQwenActivationStatus(report, targetSha, repositoryFullName);
    process.stdout.write(String(selected.runId));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
