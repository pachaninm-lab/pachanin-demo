#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This reports engineering readiness only. A separate independent review of the exact
// diff and a manual SHA-bound merge remain required. No provider grants merge authority.
export const MERGE_READINESS_SCHEMA = 'platform-v7.merge-readiness.v1';
const GREEN_CHECK_STATES = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);
const ADVISORY_STATUS_CONTEXTS = new Set([
  'review-provider/octopus', 'review-provider/local-qwen',
  'review-gate/exact-head', 'merge-readiness/exact-head',
  'deploy/pachaninm-lab/pachanin-demo',
]);
const ADVISORY_ACTIONS = [
  { path: '.github/workflows/octopus-independent-review.yml', workflow: 'Independent Octopus Review', names: ['Octopus exact-head independent review'] },
  { path: '.github/workflows/local-qwen-independent-review.yml', workflow: 'Local Qwen Independent Review', names: ['Local Qwen exact-head independent review', 'Pinned Qwen exact-head semantic review'] },
  { path: '.github/workflows/automerge.yml', workflow: 'Repo automations', names: ['Exact-head Codex review gate', 'Exact-head review gate', 'Exact-head clean-comment gate', 'Reconcile engineering readiness', 'automerge', 'Guarded automerge on PR event', 'Exact-head scheduled thread reconciliation gate', 'Guarded automerge reconciliation'] },
  { path: '.github/workflows/platform-v7-autopilot-generated-merge.yml', workflow: 'platform-v7 autopilot generated merge', names: ['merge-generated', 'reconcile-generated'] },
  { path: '.github/workflows/platform-v7-generated-pr-cleanup.yml', workflow: 'platform-v7 generated PR cleanup', names: ['cleanup'] },
];

function normalizeLogin(review) {
  return String(review?.user?.login || review?.author?.login || '').trim();
}
export function canonicalSha40(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{40}$/u.test(normalized) ? normalized : '';
}
function strictWorkflowRunSha40(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value) ? value : '';
}
export function isGitHubRepositorySlug(repo) {
  const match = typeof repo === 'string' && repo.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/u);
  return Boolean(match && !['.', '..'].includes(match[1]) && !['.', '..'].includes(match[2]));
}
export function exactHeadOwnerSelfAudits(comments, ownerLogin, headSha) {
  const owner = String(ownerLogin || '').trim();
  const expected = canonicalSha40(headSha);
  if (!owner || !expected) return [];

  return (comments || []).filter((comment) => {
    if (normalizeLogin(comment) !== owner) return false;
    const body = String(comment?.body || '');
    const matches = [...body.matchAll(/OWNER SELF-AUDIT:\s*PASS exact head\s*`([0-9a-f]{40})`/gu)];
    return matches.some((match) => match[1] === expected);
  });
}

export function activeUnresolvedThreads(threads) {
  return (threads || []).filter((thread) => thread?.isResolved !== true);
}

export function latestBlockingChangeRequests(reviews) {
  const blockedByReviewer = new Map();
  const ordered = [...(reviews || [])].sort((left, right) => {
    const leftTime = Date.parse(left?.submitted_at || left?.submittedAt || 0) || 0;
    const rightTime = Date.parse(right?.submitted_at || right?.submittedAt || 0) || 0;
    return leftTime - rightTime || Number(BigInt(left?.id || 0) - BigInt(right?.id || 0));
  });

  for (const review of ordered) {
    const login = normalizeLogin(review);
    if (!login) continue;
    const state = String(review?.state || '').toUpperCase();

    if (state === 'CHANGES_REQUESTED') {
      blockedByReviewer.set(login, review);
      continue;
    }

    if (state === 'APPROVED' || state === 'DISMISSED') {
      blockedByReviewer.delete(login);
    }
  }

  return [...blockedByReviewer.entries()]
    .map(([login, review]) => ({ login, review }));
}

function checkName(check) {
  return String(check?.context || check?.name || check?.title || '').trim();
}

function checkWorkflow(check) {
  return String(check?.workflowName || check?.workflow || '').trim();
}

function positiveIntegerString(value) {
  const normalized = String(value ?? '').trim();
  if (!/^[1-9][0-9]*$/u.test(normalized)) return '';
  const numeric = Number(normalized);
  return Number.isSafeInteger(numeric) && numeric > 0 ? normalized : '';
}

function strictGitHubActionsEvent(value) {
  if (typeof value !== 'string' || value !== value.trim()) return '';
  return /^[a-z][a-z0-9_]*$/u.test(value) ? value : '';
}

function strictGitHubRepositorySlug(value) {
  return isGitHubRepositorySlug(String(value || '').trim()) ? String(value || '').trim() : '';
}

export function strictGitHubHeadRef(value) {
  if (typeof value !== 'string' || value !== value.trim() || !value) return '';
  if (value.startsWith('/')) return '';
  if (value.endsWith('/')) return '';
  if (value.endsWith('.')) return '';
  if (value.includes('//')) return '';
  if (value.includes('..')) return '';
  if (value.includes('@{')) return '';

  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x20) return '';
    if (codePoint === 0x7f) return '';
    if ('~^:?*['.includes(character)) return '';
    if (character === '\\') return '';
  }

  const components = value.split('/');
  if (components.some((component) => component.startsWith('.') || component.endsWith('.lock'))) return '';
  return value;
}

function strictStartedAt(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function actionsRunIdFromCheck(check, repo) {
  const repository = strictGitHubRepositorySlug(repo);
  if (!repository) return '';
  const detailsUrl = String(check?.detailsUrl || check?.details_url || '').trim();
  if (!detailsUrl) return '';

  let parsed;
  try {
    parsed = new URL(detailsUrl);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.port || parsed.username || parsed.password) return '';

  const [owner, name] = repository.split('/');
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length < 5) return '';
  if (parts[0].toLowerCase() !== owner.toLowerCase() || parts[1].toLowerCase() !== name.toLowerCase()) return '';
  if (parts[2] !== 'actions' || parts[3] !== 'runs') return '';
  return positiveIntegerString(parts[4]);
}

// GitHub rewrites checks.create details_url to /runs/<check-id>. The shared
// github-actions app identity/name alone cannot establish which workflow posted it.
// Correlate our exact output contract with same-head statuses and immutable run metadata.
const READINESS_CHECK_NAME = 'Exact-head clean-comment gate';
const READINESS_STATUS_CONTEXT = 'merge-readiness/exact-head';
const READINESS_PENDING_DESCRIPTION = 'Engineering readiness is being evaluated; manual review remains required';
const READINESS_SUCCESS_DESCRIPTION = 'Engineering checks ready; independent review and manual merge still required';
const READINESS_BLOCKED_DESCRIPTION = 'Engineering readiness blocked; manual merge is not ready';

function canonicalGitHubRecordUrl(value, repo, suffix) {
  if (typeof value !== 'string') return false;
  return value === `https://github.com/${repo}/${suffix}`;
}

export function nativeReadinessRunCandidates(check, statuses, repo, prNumber, headSha) {
  if (check?.name !== READINESS_CHECK_NAME || check?.app?.id !== 15368 || check?.app?.slug !== 'github-actions'
      || check?.head_sha !== headSha || !positiveIntegerString(check?.id)
      || !canonicalGitHubRecordUrl(check?.details_url, repo, `runs/${check.id}`)
      || check?.output?.annotations_count !== 0 || check?.output?.text != null) return null;
  const started = strictStartedAt(check.started_at);
  const completed = check.status === 'completed' ? strictStartedAt(check.completed_at) : null;
  if (started === null || (check.status === 'completed' && (completed === null || completed < started))) return null;
  let state, description;
  if (check.status === 'in_progress' && check.conclusion === null
      && check.output.title === 'Engineering readiness evaluation'
      && check.output.summary === 'Independent review and a manual exact-SHA merge remain required.') {
    state = 'pending'; description = READINESS_PENDING_DESCRIPTION;
  } else if (check.status === 'completed' && ['success', 'failure'].includes(check.conclusion)) {
    state = check.conclusion;
    description = state === 'success' ? READINESS_SUCCESS_DESCRIPTION : READINESS_BLOCKED_DESCRIPTION;
    const title = state === 'success' ? 'Ready for independent manual review' : 'Engineering readiness blocked';
    const summary = `PR #${prNumber}; exact head ${headSha}. ${description}. No independent-review approval or merge authority is issued.`;
    if (check.output.title !== title || check.output.summary !== summary) return null;
  } else return null;
  if (check.external_id != null && typeof check.external_id !== 'string') return null;
  let declaredRunId = '';
  if (check.external_id) {
    const match = typeof check.external_id === 'string'
      && check.external_id.match(/^platform-v7\.merge-readiness\.v1:pr:([1-9][0-9]*):head:([0-9a-f]{40}):run:([1-9][0-9]*)$/u);
    if (!match || match[1] !== String(prNumber) || match[2] !== headSha || !positiveIntegerString(match[3])) return null;
    declaredRunId = match[3];
  } else {
    // Only completed records emitted by the pre-external_id publisher can be
    // recovered. Their exact PR/head output and status time window are required.
    if (check.status !== 'completed') return null;
  }
  const candidates = new Set();
  for (const status of statuses) {
    if (status?.context !== READINESS_STATUS_CONTEXT || status?.state !== state || status?.description !== description
        || status?.creator?.login !== 'github-actions[bot]' || status?.creator?.id !== 41898282 || status?.creator?.type !== 'Bot') continue;
    const created = strictStartedAt(status.created_at);
    if (created === null || created < started || (completed !== null && created > completed)) continue;
    const id = actionsRunIdFromCheck({ details_url: status.target_url }, repo);
    if (!id || !canonicalGitHubRecordUrl(status.target_url, repo, `actions/runs/${id}`)) continue;
    if (declaredRunId && id !== declaredRunId) continue;
    candidates.add(id);
  }
  return candidates.size === 1 ? { runId: [...candidates][0], started, completed } : null;
}

export function nativeReadinessMatchesRun(binding, run, repo, prNumber, headSha, headRef) {
  if (!binding || String(run?.id) !== binding.runId || run?.repository?.full_name !== repo
      || run?.head_repository?.full_name !== repo || run?.name !== 'Repo automations'
      || run?.path !== '.github/workflows/automerge.yml' || !strictWorkflowRunSha40(run?.head_sha)
      || !positiveIntegerString(run?.workflow_id) || !positiveIntegerString(run?.run_number)
      || !positiveIntegerString(run?.run_attempt) || !['in_progress', 'completed'].includes(run?.status)) return false;
  const created = strictStartedAt(run.created_at);
  const updated = strictStartedAt(run.updated_at);
  if (created === null || created > binding.started || updated === null || updated < created) return false;
  if (run.status === 'completed' && (binding.completed ?? binding.started) > updated) return false;
  if (run.event === 'pull_request_target') {
    if (run.head_sha !== headSha || run.head_branch !== headRef || !Array.isArray(run.pull_requests)) return false;
    const matches = run.pull_requests.filter(pr => pr?.number === prNumber && pr?.head?.sha === headSha
      && pr?.head?.ref === headRef && pr?.base?.ref === 'main');
    return matches.length === 1;
  }
  return ['issue_comment', 'workflow_dispatch', 'workflow_run'].includes(run.event) && run.head_branch === 'main';
}

export function actionsRunApiPath(repo, runId) {
  const repository = strictGitHubRepositorySlug(repo);
  const id = positiveIntegerString(runId);
  if (!repository || !id) return '';
  return `repos/${repository}/actions/runs/${id}`;
}

// Trusted-base scope checks are substantive. Only the explicit producer binding
// plus its bot status and actual Actions job can recover GitHub's rewritten URL.
export function nativeScopeGuardBinding(check, statuses, repo, prNumber, headSha) {
  if (check?.name !== 'guard' || check?.app?.id !== 15368 || check?.app?.slug !== 'github-actions'
      || check.head_sha !== headSha || !positiveIntegerString(check.id)
      || !canonicalGitHubRecordUrl(check.details_url, repo, `runs/${check.id}`)
      || check.status !== 'completed' || !['success', 'failure'].includes(check.conclusion)
      || check.output?.annotations_count !== 0 || check.output?.text != null) return null;
  const match = typeof check.external_id === 'string' && check.external_id.match(
    /^platform-v7\.scope-guard\.v1:pr:([1-9][0-9]*):head:([0-9a-f]{40}):base:([0-9a-f]{40}):run:([1-9][0-9]*):attempt:([1-9][0-9]*)$/u,
  );
  if (!match || match[1] !== String(prNumber) || match[2] !== headSha
      || !positiveIntegerString(match[4]) || !positiveIntegerString(match[5])) return null;
  const started = strictStartedAt(check.started_at), completed = strictStartedAt(check.completed_at);
  if (started === null || completed === null || completed < started) return null;
  const success = check.conclusion === 'success';
  if (check.output.title !== (success ? 'PC-CROP immutable scope accepted' : 'PC-CROP immutable scope rejected')
      || check.output.summary !== (success ? 'The exact PR head satisfies the immutable scope recorded in the trusted base.' : 'The base-controlled immutable scope check failed closed.')) return null;
  const matching = statuses.filter(status => status.context === 'scope-guard/exact-head'
    && status.state === check.conclusion
    && status.description === 'Trusted-base immutable scope result; exact PR head and workflow run required'
    && status.creator?.login === 'github-actions[bot]' && status.creator?.id === 41898282 && status.creator?.type === 'Bot'
    && canonicalGitHubRecordUrl(status.target_url, repo, `actions/runs/${match[4]}`)
    && strictStartedAt(status.created_at) !== null && strictStartedAt(status.created_at) <= started);
  if (!matching.length) return null;
  const statusTime = Math.max(...matching.map(status => strictStartedAt(status.created_at)));
  return { kind: 'scope-guard', runId: match[4], attempt: match[5], baseSha: match[3], started, completed, statusTime };
}

export function nativeScopeGuardMatchesRun(binding, check, run, rawChecks, repo, prNumber, headSha, headRef) {
  if (!binding || String(run?.id) !== binding.runId || String(run?.run_attempt) !== binding.attempt
      || run?.repository?.full_name !== repo || run?.head_repository?.full_name !== repo
      || run?.name !== 'platform-v7 autopilot guard' || run?.path !== '.github/workflows/platform-v7-autopilot-guard.yml'
      || run?.event !== 'pull_request_target' || run?.head_sha !== headSha || run?.head_branch !== headRef
      || !positiveIntegerString(run?.workflow_id) || !positiveIntegerString(run?.run_number)
      || !positiveIntegerString(run?.check_suite_id) || run?.status !== 'completed'
      || !Array.isArray(run.pull_requests)) return false;
  const prs = run.pull_requests.filter(pr => pr.number === prNumber && pr.head?.sha === headSha
    && pr.head?.ref === headRef && pr.head?.repo?.id === run.repository.id
    && pr.base?.ref === 'main' && pr.base?.sha === binding.baseSha && pr.base?.repo?.id === run.repository.id);
  if (prs.length !== 1) return false;
  const created = strictStartedAt(run.run_started_at), updated = strictStartedAt(run.updated_at);
  if (created === null || updated === null || binding.statusTime < created || binding.completed > updated) return false;
  const peers = rawChecks.filter(peer => peer.name === 'PC-CROP implementation immutable scope · trusted base'
    && peer.app?.id === 15368 && peer.app?.slug === 'github-actions' && peer.head_sha === headSha
    && actionsRunIdFromCheck(peer, repo) === binding.runId && peer.check_suite?.id === run.check_suite_id
    && peer.status === 'completed' && peer.conclusion === check.conclusion
    && strictStartedAt(peer.started_at) !== null && strictStartedAt(peer.completed_at) !== null
    && strictStartedAt(peer.started_at) <= binding.statusTime && strictStartedAt(peer.completed_at) >= binding.completed);
  return peers.length === 1;
}

export function canonicalizeExactPrHeadActionsChecks(
  checks,
  actionsRuns,
  expectedHeadSha,
  expectedHeadRef,
  repo,
) {
  const expectedSha = canonicalSha40(expectedHeadSha);
  const expectedRef = strictGitHubHeadRef(expectedHeadRef);
  const repository = strictGitHubRepositorySlug(repo);
  const sourceChecks = Array.isArray(checks) ? checks : [];
  const sourceRuns = Array.isArray(actionsRuns) ? actionsRuns : [];
  let invalid = false;

  if (!expectedSha || !expectedRef || !repository) return null;

  const indexedRuns = [];
  for (const run of sourceRuns) {
    const id = positiveIntegerString(run?.id);
    if (!id || indexedRuns.some((entry) => entry.id === id)) {
      invalid = true;
      continue;
    }
    indexedRuns.push({ id, run });
  }

  const passthrough = [];
  const currentPrActions = [];
  for (let index = 0; index < sourceChecks.length; index += 1) {
    const check = sourceChecks[index];
    const workflow = checkWorkflow(check);
    if (!workflow) {
      passthrough.push({ index, check });
      continue;
    }

    const runId = actionsRunIdFromCheck(check, repository);
    const run = runId ? indexedRuns.find((entry) => entry.id === runId)?.run : null;
    if (!runId || !run) {
      invalid = true;
      continue;
    }

    const metadataId = positiveIntegerString(run?.id);
    const workflowId = positiveIntegerString(run?.workflow_id);
    const runNumber = positiveIntegerString(run?.run_number);
    const runAttempt = positiveIntegerString(run?.run_attempt);
    const runHeadSha = strictWorkflowRunSha40(run?.head_sha);
    const runHeadRef = strictGitHubHeadRef(run?.head_branch);
    const event = strictGitHubActionsEvent(run?.event);
    const metadataFieldsValid = Boolean(metadataId && workflowId && runNumber && runAttempt && runHeadSha && runHeadRef && event);
    const exactRunBindingValid = metadataId === runId && runHeadSha === expectedSha;
    if (!metadataFieldsValid || !exactRunBindingValid) {
      invalid = true;
      continue;
    }

    // Commit rollups can include valid Actions runs for another branch pointing at the same SHA.
    // Only a run whose validated head ref exactly equals this PR's validated head ref becomes authority.
    if (runHeadRef === expectedRef) {
      currentPrActions.push({
        check,
        event,
        index,
        runId,
        runNumber: BigInt(runNumber),
        workflowId,
      });
    }
  }

  if (invalid) return null;

  const authoritativeRuns = [];
  for (const entry of currentPrActions) {
    const previousIndex = authoritativeRuns.findIndex(
      (candidate) => candidate.workflowId === entry.workflowId && candidate.event === entry.event,
    );
    if (previousIndex === -1) {
      authoritativeRuns.push({
        event: entry.event,
        runId: entry.runId,
        runNumber: entry.runNumber,
        workflowId: entry.workflowId,
      });
      continue;
    }

    const previous = authoritativeRuns[previousIndex];
    if (entry.runNumber > previous.runNumber) {
      authoritativeRuns[previousIndex] = {
        event: entry.event,
        runId: entry.runId,
        runNumber: entry.runNumber,
        workflowId: entry.workflowId,
      };
      continue;
    }
    if (entry.runNumber === previous.runNumber && entry.runId !== previous.runId) invalid = true;
  }
  if (invalid) return null;

  const selected = currentPrActions.filter((entry) => authoritativeRuns.some(
    (candidate) => candidate.workflowId === entry.workflowId
      && candidate.event === entry.event
      && candidate.runId === entry.runId,
  ));

  const selectedGroups = [];
  for (const entry of selected) {
    const name = checkName(entry.check);
    if (!name) {
      invalid = true;
      continue;
    }

    let group = selectedGroups.find(
      (candidate) => candidate.runId === entry.runId && candidate.name === name,
    );
    if (!group) {
      group = { entries: [], name, runId: entry.runId };
      selectedGroups.push(group);
    }
    group.entries.push(entry);
  }

  const deduped = [];
  for (const { entries: group } of selectedGroups) {
    if (group.length === 1) {
      deduped.push(group[0]);
      continue;
    }
    const ranked = group.map((entry) => ({ entry, startedAt: strictStartedAt(entry.check?.startedAt) }));
    if (ranked.some((item) => item.startedAt === null)) {
      invalid = true;
      continue;
    }
    ranked.sort((a, b) => b.startedAt - a.startedAt);
    if (ranked.length > 1 && ranked[0].startedAt === ranked[1].startedAt) {
      invalid = true;
      continue;
    }
    deduped.push(ranked[0].entry);
  }

  if (invalid) return null;
  return [...passthrough, ...deduped].sort((a, b) => a.index - b.index).map((entry) => entry.check);
}

export function isIgnoredMergeGateCheck(check) {
  // A familiar job name alone cannot suppress a security/test job in another workflow.
  if (check?.context && !checkWorkflow(check)) return ADVISORY_STATUS_CONTEXTS.has(check.context);
  return check?.appSlug === 'github-actions' && ADVISORY_ACTIONS.some((rule) => (
    check.workflowPath === rule.path && checkWorkflow(check) === rule.workflow && rule.names.includes(checkName(check))
  ));
}
export function substantiveChecks(checks) {
  return (checks || []).filter((check) => !isIgnoredMergeGateCheck(check));
}
export function checkRollupBlockers(checks) {
  return substantiveChecks(checks).flatMap((check) => {
    const prefix = `${checkWorkflow(check) ? `${checkWorkflow(check)} / ` : ''}${checkName(check) || 'unnamed-check'}`;
    const status = String(check?.status || '').toUpperCase();
    const conclusion = String(check?.conclusion || check?.state || '').toUpperCase();
    if (status && status !== 'COMPLETED') return [`${prefix}:${status}`];
    return GREEN_CHECK_STATES.has(conclusion) ? [] : [`${prefix}:${conclusion || 'UNKNOWN'}`];
  });
}
export function ciSnapshotMatchesHead(snapshotHeadSha, expectedHeadSha) {
  return Boolean(strictWorkflowRunSha40(snapshotHeadSha) && snapshotHeadSha === expectedHeadSha);
}
export function reviewGatePrState(pr) {
  if (pr?.state === 'closed') return 'CLOSED';
  if (pr?.state !== 'open' || typeof pr?.draft !== 'boolean') return 'INVALID';
  return pr.draft ? 'DRAFT' : 'REVIEWABLE';
}
export function mergeReadinessResult(head) {
  if (!strictWorkflowRunSha40(head)) return null;
  return { schemaVersion: MERGE_READINESS_SCHEMA, status: 'READY_FOR_MANUAL_REVIEW', head, independentReviewRequired: true, automaticMergeAllowed: false };
}
function reject(code) { throw new Error(code); }
function ghJson(args) {
  // Operational CLI errors are not safe evidence output.
  let raw;
  try { raw = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 }); }
  catch { reject('GITHUB_API_TRANSPORT_FAILED'); }
  try { return JSON.parse(raw); } catch { reject('GITHUB_API_RESPONSE_INVALID'); }
}
export function fetchAllList(endpoint, readGitHubJson = ghJson) {
  const pages = readGitHubJson(['api', '--paginate', '--slurp', `${endpoint}?per_page=100`]);
  if (!Array.isArray(pages) || !pages.length || pages.some((page) => !Array.isArray(page))) reject('GITHUB_LIST_RESPONSE_INVALID');
  const values = pages.flat();
  const ids = new Set();
  for (const value of values) {
    const id = positiveIntegerString(value?.id);
    if (!id || ids.has(id)) reject('GITHUB_LIST_IDENTITY_INVALID');
    ids.add(id);
  }
  return values;
}
export function latestCommitStatuses(statuses) {
  const selected = new Map();
  for (const status of statuses) {
    if (typeof status.context !== 'string' || !status.context.trim() || !positiveIntegerString(status.id)) return null;
    const existing = selected.get(status.context);
    // REST status IDs are monotonic; array ordering and wall clocks are not authority.
    if (!existing || BigInt(status.id) > BigInt(existing.id)) selected.set(status.context, status);
  }
  return [...selected.values()];
}
export function fetchAllReviewThreads(repo, prNumber, headSha, readGitHubJson = ghJson) {
  const [owner, name] = repo.split('/');
  const query = `query($owner:String!,$name:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){headRefOid reviewThreads(first:100,after:$endCursor){nodes{isResolved isOutdated path line} pageInfo{hasNextPage endCursor}}}}}`;
  const pages = readGitHubJson(['api', 'graphql', '--paginate', '--slurp', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${prNumber}`]);
  if (!Array.isArray(pages) || !pages.length) reject('REVIEW_THREADS_RESPONSE_INVALID');
  const threads = [], cursors = new Set();
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const pr = page?.data?.repository?.pullRequest;
    const connection = pr?.reviewThreads;
    if (page?.errors?.length || pr?.headRefOid !== headSha || !Array.isArray(connection?.nodes)) reject('REVIEW_THREADS_RESPONSE_INVALID');
    const info = connection.pageInfo;
    if (typeof info?.hasNextPage !== 'boolean' || info.hasNextPage !== (i < pages.length - 1)) reject('REVIEW_THREADS_PAGINATION_INVALID');
    if (info.hasNextPage && (typeof info.endCursor !== 'string' || !info.endCursor || cursors.has(info.endCursor))) reject('REVIEW_THREADS_PAGINATION_INVALID');
    cursors.add(info.endCursor);
    for (const thread of connection.nodes) {
      if (typeof thread?.isResolved !== 'boolean' || typeof thread?.isOutdated !== 'boolean') reject('REVIEW_THREAD_INVALID');
      threads.push(thread);
    }
  }
  return threads;
}

// Keep the #5406 workflow_id/event/MAX_RUN_NUMBER authority and the distinct
// sanitized transport diagnostic. Fetch every check/status page, not a truncated rollup.
export function fetchCheckSnapshot(repo, prNumber, readGitHubJson = ghJson) {
  const repository = strictGitHubRepositorySlug(repo);
  if (!repository) return { headSha: '', headRef: '', checks: null, runFetchErrors: [] };
  const pr = readGitHubJson(['api', `repos/${repository}/pulls/${prNumber}`]);
  const headSha = strictWorkflowRunSha40(pr?.head?.sha);
  const headRef = strictGitHubHeadRef(pr?.head?.ref);
  const invalid = { headSha, headRef, checks: null, runFetchErrors: [] };
  if (!headSha || !headRef) return invalid;
  const pages = readGitHubJson(['api', '--paginate', '--slurp', `repos/${repository}/commits/${headSha}/check-runs?per_page=100&filter=all`]);
  if (!Array.isArray(pages) || !pages.length || pages.some((page) => !Array.isArray(page?.check_runs) || !Number.isSafeInteger(page.total_count) || page.total_count < 0)) return invalid;
  const raw = pages.flatMap((page) => page.check_runs);
  if (pages.some((page) => page.total_count !== raw.length)) return invalid;
  const ids = new Set();
  for (const check of raw) {
    if (!positiveIntegerString(check?.id) || ids.has(String(check.id)) || check.head_sha !== headSha || !checkName(check) || !check.app?.slug) return invalid;
    ids.add(String(check.id));
  }
  const allStatuses = fetchAllList(`repos/${repository}/commits/${headSha}/statuses`, readGitHubJson);
  const statuses = latestCommitStatuses(allStatuses);
  if (!statuses) return invalid;
  const rawChecks = raw.map((check) => ({ ...check, appSlug: check.app.slug, startedAt: check.started_at }));
  const runIds = new Set();
  const nativeBindings = new Map();
  for (const check of rawChecks) {
    if (check.appSlug !== 'github-actions') continue;
    let id = actionsRunIdFromCheck(check, repository);
    if (!id) {
      const binding = nativeReadinessRunCandidates(check, allStatuses, repository, prNumber, headSha)
        || nativeScopeGuardBinding(check, allStatuses, repository, prNumber, headSha);
      if (!binding) return { ...invalid, metadataError: 'NATIVE_CHECK_PROVENANCE_INVALID' };
      nativeBindings.set(String(check.id), binding);
      id = binding.runId;
    }
    runIds.add(id);
  }
  const runPages = readGitHubJson(['api', '--paginate', '--slurp', `repos/${repository}/actions/runs?head_sha=${headSha}&per_page=100`]);
  if (!Array.isArray(runPages) || !runPages.length || runPages.some((page) => !Array.isArray(page?.workflow_runs) || !Number.isSafeInteger(page.total_count) || page.total_count < 0)) return invalid;
  const listedRuns = runPages.flatMap((page) => page.workflow_runs);
  if (runPages.some((page) => page.total_count !== listedRuns.length)) return invalid;
  const listedIds = new Set();
  for (const run of listedRuns) {
    const id = positiveIntegerString(run?.id);
    if (!id || listedIds.has(id) || run.head_sha !== headSha) return invalid;
    listedIds.add(id);
    runIds.add(id);
  }
  const actionsRuns = [], runFetchErrors = [];
  for (const runId of runIds) {
    try { actionsRuns.push(readGitHubJson(['api', actionsRunApiPath(repository, runId)])); }
    catch { runFetchErrors.push({ runId, code: 'ACTIONS_RUN_FETCH_FAILED' }); }
  }
  if (runFetchErrors.length) return { ...invalid, runFetchErrors };
  const historicalAttempts = new Map();
  for (const check of rawChecks) {
    if (check.appSlug !== 'github-actions') continue;
    const binding = nativeBindings.get(String(check.id));
    const id = binding?.runId || actionsRunIdFromCheck(check, repository);
    const run = actionsRuns.find((value) => String(value?.id) === id);
    if (!run || typeof run.name !== 'string' || !run.name || typeof run.path !== 'string' || !run.path.startsWith('.github/workflows/')) return invalid;
    if (run.repository?.full_name?.toLowerCase() !== repository.toLowerCase()) return invalid;
    if (binding) {
      let producerRun = run;
      if (binding.kind === 'scope-guard' && String(run.run_attempt) !== binding.attempt) {
        if (!positiveIntegerString(run.run_attempt) || BigInt(binding.attempt) > BigInt(run.run_attempt)) return { ...invalid, metadataError: 'NATIVE_CHECK_PROVENANCE_INVALID' };
        const attemptPath = `${actionsRunApiPath(repository, binding.runId)}/attempts/${binding.attempt}`;
        if (!historicalAttempts.has(attemptPath)) {
          try { historicalAttempts.set(attemptPath, readGitHubJson(['api', attemptPath])); }
          catch { return { ...invalid, runFetchErrors: [{ runId: binding.runId, code: 'ACTIONS_RUN_ATTEMPT_FETCH_FAILED' }] }; }
        }
        producerRun = historicalAttempts.get(attemptPath);
      }
      const verified = binding.kind === 'scope-guard'
        ? nativeScopeGuardMatchesRun(binding, check, producerRun, rawChecks, repository, prNumber, headSha, headRef)
        : nativeReadinessMatchesRun(binding, run, repository, prNumber, headSha, headRef);
      if (!verified) return { ...invalid, metadataError: 'NATIVE_CHECK_PROVENANCE_INVALID' };
      if (binding.kind === 'scope-guard') check.detailsUrl = `https://github.com/${repository}/actions/runs/${binding.runId}`;
    }
    check.workflowName = run.name;
    check.workflowPath = run.path;
  }
  const runSummaries = [];
  for (const run of actionsRuns) {
    if (!positiveIntegerString(run?.id) || typeof run.name !== 'string' || !run.name || typeof run.path !== 'string' || !run.path.startsWith('.github/workflows/') || run.repository?.full_name?.toLowerCase() !== repository.toLowerCase()) return invalid;
    // Availability/controller run summaries cannot deadlock readiness. Unexpected actual
    // jobs inside those workflows are still checked individually above and below.
    if (ADVISORY_ACTIONS.some((rule) => run.path === rule.path && run.name === rule.workflow)) continue;
    runSummaries.push({ appSlug: 'github-actions', workflowName: run.name, workflowPath: run.path,
      name: '__workflow_run__', status: run.status, conclusion: run.conclusion,
      detailsUrl: `https://github.com/${repository}/actions/runs/${run.id}`, startedAt: run.run_started_at });
  }
  // Full run inventory prevents an older green from hiding a newer queued run with no jobs yet.
  // Only proven availability/controller jobs are advisory, never every job in their workflow.
  const substantive = substantiveChecks([...rawChecks, ...statuses, ...runSummaries]);
  const neededRuns = actionsRuns.filter((run) => substantive.some((check) => checkWorkflow(check) && actionsRunIdFromCheck(check, repository) === String(run?.id)));
  const checks = canonicalizeExactPrHeadActionsChecks(substantive, neededRuns, headSha, headRef, repository);
  return { headSha, headRef, checks, runFetchErrors };
}

export function verifyManualReadiness({ argv = [], env = {}, readGitHubJson = ghJson } = {}) {
  if (argv.length !== 1 || argv[0] !== '--manual-readiness') reject('AUTOMATIC_MERGE_DISABLED');
  const repo = env.GITHUB_REPOSITORY || env.REPO || '';
  if (!isGitHubRepositorySlug(repo)) reject('MERGE_READINESS_REPO_INVALID');
  if (env.REPO && env.GITHUB_REPOSITORY && env.REPO.toLowerCase() !== env.GITHUB_REPOSITORY.toLowerCase()) reject('MERGE_READINESS_REPO_AUTHORITY_MISMATCH');
  const prNumber = Number(env.PR_NUMBER);
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) reject('MERGE_READINESS_PR_INVALID');
  const headSha = strictWorkflowRunSha40(env.HEAD_SHA);
  if (!headSha) reject('MERGE_READINESS_EXPECTED_HEAD_INVALID');
  const pr = readGitHubJson(['api', `repos/${repo}/pulls/${prNumber}`]);
  if (reviewGatePrState(pr) !== 'REVIEWABLE') reject('MERGE_READINESS_PR_NOT_REVIEWABLE');
  if (pr.auto_merge !== null) reject('AUTOMATIC_MERGE_DISABLED');
  if (pr.number !== prNumber) reject('MERGE_READINESS_PR_IDENTITY_INVALID');
  if (pr?.base?.repo?.full_name?.toLowerCase() !== repo.toLowerCase()) reject('MERGE_READINESS_PR_REPOSITORY_MISMATCH');
  if (pr?.head?.sha !== headSha) reject('MERGE_READINESS_HEAD_MOVED');
  const headRef = strictGitHubHeadRef(pr?.head?.ref);
  if (!headRef) reject('MERGE_READINESS_HEAD_REF_INVALID');
  const reviews = fetchAllList(`repos/${repo}/pulls/${prNumber}/reviews`, readGitHubJson);
  if (reviews.some((review) => !normalizeLogin(review) || !['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'].includes(review.state) || (review.state !== 'PENDING' && strictStartedAt(review.submitted_at) === null))) reject('MERGE_READINESS_REVIEW_METADATA_INVALID');
  const comments = fetchAllList(`repos/${repo}/issues/${prNumber}/comments`, readGitHubJson);
  if (!exactHeadOwnerSelfAudits(comments, repo.split('/')[0], headSha).length) reject('MERGE_READINESS_OWNER_AUDIT_MISSING');
  if (latestBlockingChangeRequests(reviews).length) reject('MERGE_READINESS_CHANGES_REQUESTED');
  if (activeUnresolvedThreads(fetchAllReviewThreads(repo, prNumber, headSha, readGitHubJson)).length) reject('MERGE_READINESS_UNRESOLVED_THREADS');
  // Legacy provider summaries remain visible to the independent reviewer. Their output
  // syntax, missing output or quota is not a machine verdict on the code itself.
  const snapshot = fetchCheckSnapshot(repo, prNumber, readGitHubJson);
  if (snapshot.headSha !== headSha || snapshot.headRef !== headRef) reject('MERGE_READINESS_CI_HEAD_MISMATCH');
  if (snapshot.runFetchErrors.length) reject('MERGE_READINESS_CI_ACTIONS_RUN_FETCH_FAILED');
  if (snapshot.metadataError === 'NATIVE_CHECK_PROVENANCE_INVALID') reject('MERGE_READINESS_CI_NATIVE_CHECK_PROVENANCE_INVALID');
  if (!Array.isArray(snapshot.checks)) reject('MERGE_READINESS_CI_SNAPSHOT_INVALID');
  if (!snapshot.checks.length) reject('MERGE_READINESS_CI_EVIDENCE_MISSING');
  if (checkRollupBlockers(snapshot.checks).length) reject('MERGE_READINESS_CI_NOT_GREEN');
  const finalPr = readGitHubJson(['api', `repos/${repo}/pulls/${prNumber}`]);
  if (finalPr?.auto_merge !== null) reject('AUTOMATIC_MERGE_DISABLED');
  if (finalPr?.head?.sha !== headSha || finalPr?.head?.ref !== headRef || reviewGatePrState(finalPr) !== 'REVIEWABLE') reject('MERGE_READINESS_HEAD_MOVED_DURING_VERIFICATION');
  return mergeReadinessResult(headSha);
}
const invokedPath = process.argv[1] || '';
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  try {
    const result = verifyManualReadiness({ argv: process.argv.slice(2), env: process.env });
    console.log(`MERGE_READINESS_RESULT=${JSON.stringify(result)}`);
  } catch (error) {
    // Never emit raw GitHub/transport/operational error text.
    const code = /^[A-Z][A-Z0-9_]+$/u.test(error?.message || '') ? error.message : 'MERGE_READINESS_INPUT_FAILED';
    console.error(code);
    process.exitCode = 1;
  }
}
