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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , reportPath, ...requiredNames] = process.argv;
  if (!reportPath || requiredNames.length < 1) {
    console.error('usage: verify-tai-upstream-workflow-jobs.mjs REPORT JOB_NAME...');
    process.exit(2);
  }
  try {
    verifyWorkflowJobs(JSON.parse(readFileSync(reportPath, 'utf8')), requiredNames);
    console.log(`Upstream workflow jobs PASS: ${requiredNames.length} exact jobs completed successfully.`);
  } catch (error) {
    console.error(`Upstream workflow jobs blocked: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
