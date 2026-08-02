#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyWorkflowJobs, verifyWorkflowRun } from './verify-tai-upstream-workflow-jobs.mjs';

export const OWNER_COMMAND_WORKFLOW = 'TAI Exact-Release Owner Command';
export const OWNER_COMMAND_JOB = 'Dispatch exact-current-main images, platform and TAI preflight';
export const OWNER_COMMAND_PATH = '.github/workflows/tai-reg-ru-preflight-owner-command.yml';
export const OWNER_COMMAND_BODY = '/tai release current-main';
export const OWNER_COMMAND_ISSUE = 3365;

export function verifyOwnerCommandAuthority(
  runReport,
  jobsReport,
  commentReport,
  expectedSha,
  expectedAttempt,
  expectedRepository,
  expectedOwner,
  expectedCommentId,
) {
  verifyWorkflowRun(
    runReport,
    expectedSha,
    expectedAttempt,
    OWNER_COMMAND_WORKFLOW,
    expectedRepository,
  );

  if (!/^[A-Za-z0-9_.-]+$/.test(expectedOwner)) {
    throw new Error('expected repository owner is invalid');
  }
  const commentId = Number(expectedCommentId);
  if (!Number.isInteger(commentId) || commentId < 1) {
    throw new Error('expected command comment ID is invalid');
  }
  if (runReport.event !== 'issue_comment') throw new Error('owner command event mismatch');
  if (runReport.path !== OWNER_COMMAND_PATH) throw new Error('owner command workflow path mismatch');
  if (runReport.actor?.login !== expectedOwner) throw new Error('owner command actor mismatch');
  if (runReport.triggering_actor?.login !== expectedOwner) {
    throw new Error('owner command triggering actor mismatch');
  }

  verifyWorkflowJobs(jobsReport, [OWNER_COMMAND_JOB]);

  if (!commentReport || typeof commentReport !== 'object' || Array.isArray(commentReport)) {
    throw new Error('owner command comment response must be an object');
  }
  if (commentReport.id !== commentId) throw new Error('owner command comment ID mismatch');
  if (commentReport.user?.login !== expectedOwner) throw new Error('owner command commenter mismatch');
  if (commentReport.body !== OWNER_COMMAND_BODY) throw new Error('owner command body mismatch');
  const expectedIssueSuffix = `/repos/${expectedRepository}/issues/${OWNER_COMMAND_ISSUE}`;
  if (typeof commentReport.issue_url !== 'string' || !commentReport.issue_url.endsWith(expectedIssueSuffix)) {
    throw new Error('owner command issue mismatch');
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [
    ,
    ,
    runPath,
    jobsPath,
    commentPath,
    expectedSha,
    expectedAttempt,
    expectedRepository,
    expectedOwner,
    expectedCommentId,
  ] = process.argv;
  if (
    !runPath
    || !jobsPath
    || !commentPath
    || !expectedSha
    || !expectedAttempt
    || !expectedRepository
    || !expectedOwner
    || !expectedCommentId
  ) {
    console.error('usage: verify-owner-command-authority.mjs RUN JOBS COMMENT SHA ATTEMPT REPOSITORY OWNER COMMENT_ID');
    process.exit(2);
  }
  try {
    verifyOwnerCommandAuthority(
      JSON.parse(readFileSync(runPath, 'utf8')),
      JSON.parse(readFileSync(jobsPath, 'utf8')),
      JSON.parse(readFileSync(commentPath, 'utf8')),
      expectedSha,
      expectedAttempt,
      expectedRepository,
      expectedOwner,
      expectedCommentId,
    );
    console.log(`Owner command authority PASS: ${OWNER_COMMAND_WORKFLOW} exact attempt and comment are trusted.`);
  } catch (error) {
    console.error(`Owner command authority blocked: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
