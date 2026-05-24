#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STATE_PATH = 'docs/platform-v7/autopilot/autopilot-state.json';
const QUEUE_PATH = 'docs/platform-v7/execution-queue.md';
const PROGRESS_PATH = 'docs/platform-v7/autopilot/progress.json';
const CURRENT_CODEX_PROMPT_PATH = 'docs/platform-v7/autopilot/prompts/current-codex-task.md';
const CURRENT_REVIEW_PROMPT_PATH = 'docs/platform-v7/autopilot/prompts/current-review-task.md';

const FORBIDDEN_CLAIMS = [
  'production-ready',
  'fully live',
  'fully integrated',
  'platform guarantees payment',
  'платформа гарантирует оплату',
  'платформа сама выпускает деньги',
  'банк подключён',
  'ФГИС подключён',
  'ЭДО подключён',
];

const CONTROLLED_PILOT_NOTICE = [
  'Maturity: controlled-pilot / pre-integration.',
  'Do not overstate maturity or imply live external integrations.',
  'Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.',
  'Do not auto-merge. Human review and green checks are required.',
].join('\n');

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

async function readText(relativePath) {
  return readFile(repoPath(relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function writeJson(relativePath, value) {
  await writeFile(repoPath(relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseCurrentFromQueue(queue) {
  const match = queue.match(/^CURRENT:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function parseListAfterHeading(queue, heading) {
  const lines = queue.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${heading}:`);
  if (start === -1) return [];

  const items = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Z][A-Z\s]+:/.test(line.trim())) break;
    const item = line.match(/^-\s+(.+)$/);
    if (item) items.push(item[1].trim());
  }

  return items;
}

function stepSlug(step) {
  return step
    .toLowerCase()
    .replace(/—/g, '-')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function promptNameForCurrent(current, kind) {
  const match = current.match(/PR\s+([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const stepId = match[1];
  return `docs/platform-v7/autopilot/prompts/${kind}-pr-${stepId}.md`;
}

function isGreenOrClosed(state) {
  const status = String(state.currentStatus ?? state.currentState ?? state.status ?? '').toLowerCase();
  return ['green', 'closed', 'mergeable', 'merged'].includes(status);
}

function assertNoForbiddenClaim(text, target) {
  const lowered = text.toLowerCase();
  const found = FORBIDDEN_CLAIMS.filter((claim) => lowered.includes(claim.toLowerCase()));
  const allowedAsGuardrail = found.filter((claim) => {
    const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(do not|no|not|forbidden|запрещ)[^\\n]*${escaped}`, 'i').test(text);
  });
  if (found.length > allowedAsGuardrail.length) {
    throw new Error(`Forbidden maturity/integration claim found in ${target}: ${found.join(', ')}`);
  }
}

function buildCurrentPrompt(input) {
  const {
    state,
    queue,
    current,
    nextCandidate,
    blockedBy,
    sourcePrompt,
  } = input;

  return [
    `# Codex current task — ${current}`,
    '',
    CONTROLLED_PILOT_NOTICE,
    '',
    '## Source of truth',
    '',
    `- State: \`${STATE_PATH}\``,
    `- Queue: \`${QUEUE_PATH}\``,
    `- Progress: \`${PROGRESS_PATH}\``,
    '',
    '## Current step',
    '',
    current,
    '',
    '## Next candidate',
    '',
    nextCandidate,
    '',
    '## Transition guard',
    '',
    blockedBy.length > 0
      ? blockedBy.map((item) => `- BLOCKED: ${item}`).join('\n')
      : '- Current step is allowed to advance after human-reviewed green/closed/mergeable status.',
    '',
    '## Allowed current scope',
    '',
    ...(state.allowedCurrentScope ?? []).map((item) => `- ${item}`),
    '',
    '## Forbidden zones',
    '',
    ...(state.forbiddenZones ?? []).map((item) => `- ${item}`),
    '',
    '## Active queue',
    '',
    queue,
    '',
    '## Implementation brief',
    '',
    sourcePrompt.trim(),
    '',
  ].join('\n');
}

function buildReviewPrompt(input) {
  const {
    state,
    queue,
    current,
    sourceReview,
    blockedBy,
  } = input;

  return [
    `# Review current task — ${current}`,
    '',
    CONTROLLED_PILOT_NOTICE,
    '',
    'Review the diff, not the agent report.',
    '',
    '## Required scope checks',
    '',
    '- `apps/landing` diff must be 0.',
    '- UI/visual/theme/onboarding diff must be 0 unless explicitly allowed by the current step.',
    '- adapters/server-actions/AI gateway diff must be 0 unless explicitly allowed by the current step.',
    '- no auto-merge behavior.',
    '- no fake-live or maturity overclaim.',
    '',
    '## Current allowed scope',
    '',
    ...(state.allowedCurrentScope ?? []).map((item) => `- ${item}`),
    '',
    '## Transition guard',
    '',
    blockedBy.length > 0
      ? blockedBy.map((item) => `- BLOCKED: ${item}`).join('\n')
      : '- Current step may be advanced only after human merge approval.',
    '',
    '## Queue snapshot',
    '',
    queue,
    '',
    '## Review brief',
    '',
    sourceReview.trim(),
    '',
    'Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.',
    '',
  ].join('\n');
}

async function main() {
  const state = await readJson(STATE_PATH);
  const queue = await readText(QUEUE_PATH);
  const current = state.current ?? parseCurrentFromQueue(queue);
  if (!current) throw new Error('Cannot determine current platform-v7 autopilot step.');

  const locked = state.lockedUntilCurrentGreen ?? parseListAfterHeading(queue, 'LOCKED UNTIL 5.1 GREEN');
  const nextCandidate = locked[0] ?? 'No queued next step.';
  const currentClosed = isGreenOrClosed(state);
  const blockedBy = currentClosed
    ? []
    : [`${current} is not green/closed/mergeable. Dispatcher will not advance to ${nextCandidate}.`];

  const codexPromptPath = promptNameForCurrent(current, 'codex');
  const reviewPromptPath = promptNameForCurrent(current, 'review');
  const sourcePrompt = codexPromptPath && existsSync(repoPath(codexPromptPath))
    ? await readText(codexPromptPath)
    : `Implement ${current} strictly inside the state allowed scope.`;
  const sourceReview = reviewPromptPath && existsSync(repoPath(reviewPromptPath))
    ? await readText(reviewPromptPath)
    : `Review ${current} strictly against the state allowed scope and queue.`;

  const currentCodexPrompt = buildCurrentPrompt({
    state,
    queue,
    current,
    nextCandidate,
    blockedBy,
    sourcePrompt,
  });
  const currentReviewPrompt = buildReviewPrompt({
    state,
    queue,
    current,
    sourceReview,
    blockedBy,
  });

  assertNoForbiddenClaim(currentCodexPrompt, CURRENT_CODEX_PROMPT_PATH);
  assertNoForbiddenClaim(currentReviewPrompt, CURRENT_REVIEW_PROMPT_PATH);

  await writeFile(repoPath(CURRENT_CODEX_PROMPT_PATH), currentCodexPrompt, 'utf8');
  await writeFile(repoPath(CURRENT_REVIEW_PROMPT_PATH), currentReviewPrompt, 'utf8');

  const previousProgress = existsSync(repoPath(PROGRESS_PATH))
    ? await readJson(PROGRESS_PATH)
    : {};
  const progress = {
    project: 'platform-v7 / Прозрачная Цена',
    fullTzReadinessPercent: Number(previousProgress.fullTzReadinessPercent ?? state.fullTzReadinessPercent ?? 0),
    currentStep: current,
    lastCompletedStep: Array.isArray(state.lastClosed) ? state.lastClosed.at(-1) ?? '' : '',
    openPr: state.openPr ?? null,
    blockedBy,
    nextStep: currentClosed ? nextCandidate : current,
    updatedAt: new Date().toISOString(),
    rules: {
      noAppsLanding: true,
      noFakeLiveClaims: true,
      noAutoMerge: true,
      controlledPilotOnly: true,
    },
  };
  await writeJson(PROGRESS_PATH, progress);

  console.log(`platform-v7 dispatcher current: ${current}`);
  console.log(`platform-v7 dispatcher prompt: ${CURRENT_CODEX_PROMPT_PATH}`);
  console.log(`platform-v7 dispatcher review: ${CURRENT_REVIEW_PROMPT_PATH}`);
  console.log(`platform-v7 dispatcher progress: ${PROGRESS_PATH}`);
  console.log(`platform-v7 dispatcher branch slug: ${stepSlug(current)}`);
  if (blockedBy.length > 0) {
    console.log(`platform-v7 dispatcher blocked: ${blockedBy.join(' | ')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
