#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function verifyWorkflowJobs(report, requiredNames) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('workflow jobs response must be an object');
  }
  if (!Number.isInteger(report.total_count) || report.total_count < 0 || report.total_count > 100) {
    throw new Error('workflow jobs response is incomplete or unbounded');
  }
  if (!Array.isArray(report.jobs) || report.jobs.length !== report.total_count) {
    throw new Error('workflow jobs response count mismatch');
  }
  if (!Array.isArray(requiredNames) || requiredNames.length < 1 || new Set(requiredNames).size !== requiredNames.length) {
    throw new Error('required workflow job names are invalid');
  }
  for (const requiredName of requiredNames) {
    const matches = report.jobs.filter((job) => job?.name === requiredName);
    if (matches.length !== 1) {
      throw new Error(`workflow job ${JSON.stringify(requiredName)} must exist exactly once`);
    }
    if (matches[0].status !== 'completed' || matches[0].conclusion !== 'success') {
      throw new Error(`workflow job ${JSON.stringify(requiredName)} did not complete successfully`);
    }
  }
  return true;
}

export function verifyWorkflowRun(report, expectedSha, expectedAttempt, expectedName) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('workflow run response must be an object');
  }
  const attempt = Number(expectedAttempt);
  if (!/^[0-9a-f]{40}$/.test(expectedSha) || !Number.isInteger(attempt) || attempt < 1 || !expectedName) {
    throw new Error('expected workflow run authority is invalid');
  }
  if (report.name !== expectedName) throw new Error('workflow name mismatch');
  if (report.head_sha !== expectedSha) throw new Error('workflow target SHA mismatch');
  if (report.head_branch !== 'main') throw new Error('workflow branch mismatch');
  if (report.run_attempt !== attempt) throw new Error('workflow run attempt mismatch');
  if (report.status !== 'completed' || report.conclusion !== 'success') {
    throw new Error('workflow run did not complete successfully');
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , mode, reportPath, ...authority] = process.argv;
  if (!['--run', '--jobs'].includes(mode) || !reportPath || authority.length < 1) {
    console.error('usage: verify-tai-upstream-workflow-jobs.mjs --run REPORT SHA ATTEMPT NAME | --jobs REPORT JOB_NAME...');
    process.exit(2);
  }
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    if (mode === '--run') {
      if (authority.length !== 3) throw new Error('workflow run authority argument count is invalid');
      verifyWorkflowRun(report, authority[0], authority[1], authority[2]);
      console.log(`Upstream workflow run PASS: ${authority[2]} exact attempt is successful.`);
    } else {
      verifyWorkflowJobs(report, authority);
      console.log(`Upstream workflow jobs PASS: ${authority.length} exact jobs completed successfully.`);
    }
  } catch (error) {
    console.error(`Upstream workflow authority blocked: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
