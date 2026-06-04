#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CATEGORIES = [
  'scope_failure',
  'typecheck_failure',
  'test_failure',
  'build_failure',
  'flaky_infra_failure',
  'forbidden_path_failure',
  'maturity_copy_failure',
  'unknown_failure',
];

function parseArgs(argv) {
  const options = {
    workflowRunsPath: null,
    jobsPath: null,
    logPath: null,
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workflow-runs') options.workflowRunsPath = argv[++index];
    else if (arg === '--jobs') options.jobsPath = argv[++index];
    else if (arg === '--log') options.logPath = argv[++index];
    else if (arg === '--output') options.outputPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function readJsonFile(filePath, fallback) {
  if (!filePath) return fallback;
  return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
}

async function readTextFile(filePath) {
  if (!filePath) return '';
  return readFile(path.resolve(filePath), 'utf8');
}

function asArray(input, key) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input?.[key])) return input[key];
  return [];
}

function firstFailedStep(job) {
  return (job.steps ?? []).find((step) => {
    const conclusion = String(step.conclusion ?? step.status ?? '').toLowerCase();
    return ['failure', 'cancelled', 'timed_out', 'action_required'].includes(conclusion);
  }) ?? null;
}

function logExcerpt(logText, stepName) {
  if (!logText.trim()) return '';
  const lines = logText.split(/\r?\n/);
  const needle = String(stepName ?? '').toLowerCase();
  let start = lines.findIndex((line) => needle && line.toLowerCase().includes(needle));
  if (start === -1) {
    start = lines.findIndex((line) => /error|failed|forbidden|scope|red|permission denied|timeout/i.test(line));
  }
  if (start === -1) start = 0;
  return lines.slice(start, start + 24).join('\n').slice(0, 4000);
}

function classifyFailure(input) {
  const text = [
    input.workflowName,
    input.jobName,
    input.failedStep,
    input.conclusion,
    input.logExcerpt,
  ].join('\n').toLowerCase();

  if (/apps\/landing|package-lock\.json|pnpm-lock\.yaml|forbidden path|forbidden scope|outside current autopilot scope/.test(text)) {
    return 'forbidden_path_failure';
  }
  if (/scope guard|scope_failure|files outside current autopilot scope/.test(text)) {
    return 'scope_failure';
  }
  if (/production-ready|fully live|fully integrated|fake-live|fake live|банк подключ|фгис подключ|эдо подключ|maturity/.test(text)) {
    return 'maturity_copy_failure';
  }
  if (/tsc|typecheck|typescript|type error|ts\d{4}/.test(text)) {
    return 'typecheck_failure';
  }
  if (/jest|vitest|playwright|test files|test suites|expect\(|assertion|failed tests?/.test(text)) {
    return 'test_failure';
  }
  if (/build failed|next build|vite build|webpack|rollup|compile failed/.test(text)) {
    return 'build_failure';
  }
  if (/timeout|timed out|rate limit|5\d\d|network|econnreset|temporary|cancelled|runner lost/.test(text)) {
    return 'flaky_infra_failure';
  }
  return 'unknown_failure';
}

function normalizeWorkflowRun(run) {
  return {
    id: run.id ?? run.run_id ?? null,
    workflowName: run.name ?? run.workflow_name ?? 'unknown workflow',
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
  };
}

function analyze(workflowRunsInput, jobsInput, logText) {
  const workflowRuns = asArray(workflowRunsInput, 'workflow_runs').map(normalizeWorkflowRun);
  const jobs = asArray(jobsInput, 'jobs');
  const failedJobs = jobs.filter((job) => {
    const conclusion = String(job.conclusion ?? job.status ?? '').toLowerCase();
    return ['failure', 'cancelled', 'timed_out', 'action_required'].includes(conclusion);
  });

  const failures = failedJobs.map((job) => {
    const step = firstFailedStep(job);
    const run = workflowRuns.find((candidate) => String(candidate.id) === String(job.run_id)) ?? workflowRuns[0];
    const entry = {
      workflowName: job.workflow_name ?? run?.workflowName ?? 'unknown workflow',
      jobName: job.name ?? 'unknown job',
      failedStep: step?.name ?? null,
      logExcerpt: logExcerpt(logText, step?.name ?? job.name),
      conclusion: job.conclusion ?? step?.conclusion ?? 'failure',
      suspectedCategory: 'unknown_failure',
    };
    entry.suspectedCategory = classifyFailure(entry);
    return entry;
  });

  const failedWorkflowRuns = workflowRuns
    .filter((run) => ['failure', 'cancelled', 'timed_out', 'action_required'].includes(String(run.conclusion).toLowerCase()))
    .filter((run) => !failures.some((failure) => failure.workflowName === run.workflowName))
    .map((run) => {
      const entry = {
        workflowName: run.workflowName,
        jobName: 'unknown job',
        failedStep: null,
        logExcerpt: logExcerpt(logText, run.workflowName),
        conclusion: run.conclusion,
        suspectedCategory: 'unknown_failure',
      };
      entry.suspectedCategory = classifyFailure(entry);
      return entry;
    });

  const allFailures = [...failures, ...failedWorkflowRuns];
  return {
    generatedAt: new Date().toISOString(),
    categories: CATEGORIES,
    summary: {
      totalFailures: allFailures.length,
      byCategory: allFailures.reduce((acc, failure) => {
        acc[failure.suspectedCategory] = (acc[failure.suspectedCategory] ?? 0) + 1;
        return acc;
      }, {}),
    },
    failures: allFailures,
  };
}

export async function analyzeCheckFailures(options = {}) {
  const [workflowRunsInput, jobsInput, logText] = await Promise.all([
    readJsonFile(options.workflowRunsPath, { workflow_runs: [] }),
    readJsonFile(options.jobsPath, { jobs: [] }),
    readTextFile(options.logPath),
  ]);
  return analyze(workflowRunsInput, jobsInput, logText);
}

async function cli() {
  const options = parseArgs(process.argv.slice(2));
  const report = await analyzeCheckFailures(options);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputPath) {
    await writeFile(path.resolve(options.outputPath), output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  if (report.summary.totalFailures > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
