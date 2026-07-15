#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REGISTRY_PATH = resolve(
  process.env.SECURITY_ABUSE_REGISTRY
    ?? 'docs/platform-v7/autopilot/security-abuse-cases.json',
);
const REPORT_PATH = resolve(
  process.env.SECURITY_ABUSE_REPORT
    ?? 'artifacts/security/security-abuse-evidence.json',
);
const JUNIT_PATH = resolve(
  process.env.SECURITY_ABUSE_JUNIT
    ?? 'artifacts/security/security-abuse-junit.xml',
);
const LOG_DIR = resolve(
  process.env.SECURITY_ABUSE_LOG_DIR
    ?? 'artifacts/security/abuse-logs',
);
const EXACT_HEAD = String(process.env.SECURITY_EXACT_HEAD ?? '').trim();

const REQUIRED_SCENARIOS = [
  'idor',
  'tenant_escape',
  'horizontal_privilege_escalation',
  'vertical_privilege_escalation',
  'refresh_replay',
  'callback_signature',
  'callback_replay',
  'oversized_payload',
  'unrestricted_upload',
  'path_traversal',
];

const PHASES = [
  {
    id: 'unit-boundaries',
    command: 'pnpm --filter @pc/api exec prisma generate --schema prisma/schema.prisma && pnpm --filter @pc/api exec jest --runInBand --runTestsByPath src/common/security/request-body-limit.spec.ts src/modules/labs/lab-evidence-upload.security.spec.ts src/modules/deals/industrial-deal-command.gateway.spec.ts',
  },
  {
    id: 'one-deal',
    command: 'bash scripts/platform-v7-one-deal-e2e.sh',
  },
  {
    id: 'auth-replay',
    dependsOn: 'one-deal',
    command: 'DATABASE_URL="$ONE_DEAL_AUTH_URL" AUTH_DATABASE_URL="$ONE_DEAL_AUTH_URL" DB_PRINCIPAL_BOUNDARY_ENFORCED=false pnpm --filter @pc/api exec jest --runInBand --config test/auth/jest.config.json --runTestsByPath test/auth/persistent-auth.e2e-spec.ts --testNamePattern "rotates refresh once and revokes the complete family on old-token reuse across instances"',
  },
];

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is missing or invalid JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function validateRegistry(registry) {
  if (!EXACT_HEAD || !/^[a-f0-9]{40}$/i.test(EXACT_HEAD)) {
    throw new Error('SECURITY_EXACT_HEAD must be the exact 40-character commit SHA.');
  }
  if (registry?.schemaVersion !== 1 || registry?.repository !== 'pachaninm-lab/pachanin-demo') {
    throw new Error('Security abuse registry identity or schema version is invalid.');
  }
  if (JSON.stringify(registry.requiredScenarioIds) !== JSON.stringify(REQUIRED_SCENARIOS)) {
    throw new Error('Security abuse registry requiredScenarioIds must match the immutable release policy.');
  }
  if (!Array.isArray(registry.scenarios)) throw new Error('Security abuse registry scenarios must be an array.');

  const ids = registry.scenarios.map((scenario) => scenario?.id);
  if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify(REQUIRED_SCENARIOS)) {
    throw new Error('Security abuse scenarios must exist exactly once and in release-policy order.');
  }

  const validPhases = new Set(PHASES.map((phase) => phase.id));
  for (const scenario of registry.scenarios) {
    if (!Array.isArray(scenario.phaseIds) || scenario.phaseIds.length === 0) {
      throw new Error(`Scenario ${scenario.id} must reference at least one execution phase.`);
    }
    for (const phaseId of scenario.phaseIds) {
      if (!validPhases.has(phaseId)) throw new Error(`Scenario ${scenario.id} references unknown phase ${phaseId}.`);
    }
    if (!Array.isArray(scenario.evidence) || scenario.evidence.length === 0) {
      throw new Error(`Scenario ${scenario.id} must have source evidence.`);
    }
    for (const evidence of scenario.evidence) {
      const path = resolve(String(evidence?.path ?? ''));
      if (!existsSync(path)) throw new Error(`Scenario ${scenario.id} evidence file is missing: ${evidence?.path}`);
      const source = readFileSync(path, 'utf8');
      if (/\b(?:describe|it|test)\.(?:skip|todo)\b/.test(source)) {
        throw new Error(`Scenario ${scenario.id} evidence contains skipped or todo tests: ${evidence.path}`);
      }
      if (!Array.isArray(evidence.markers) || evidence.markers.length === 0) {
        throw new Error(`Scenario ${scenario.id} evidence has no required markers: ${evidence.path}`);
      }
      for (const marker of evidence.markers) {
        if (!source.includes(marker)) {
          throw new Error(`Scenario ${scenario.id} evidence marker is missing in ${evidence.path}: ${marker}`);
        }
      }
    }
  }
}

function runPhase(phase, phaseResults) {
  const dependency = phase.dependsOn ? phaseResults.get(phase.dependsOn) : undefined;
  if (dependency && !dependency.passed) {
    return {
      id: phase.id,
      commandSha256: sha256(phase.command),
      startedAt: null,
      finishedAt: null,
      durationMs: 0,
      exitCode: null,
      passed: false,
      skipped: true,
      reason: `Dependency phase ${phase.dependsOn} failed.`,
      logPath: null,
      logSha256: null,
    };
  }

  const startedAt = new Date();
  const started = Date.now();
  const result = spawnSync('bash', ['-lc', phase.command], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: process.env,
  });
  const finishedAt = new Date();
  const output = [
    `$ ${phase.command}`,
    result.stdout ?? '',
    result.stderr ?? '',
    result.error ? String(result.error) : '',
  ].filter(Boolean).join('\n');
  const logPath = resolve(LOG_DIR, `${phase.id}.log`);
  writeFileSync(logPath, `${output}\n`);
  const exitCode = Number.isInteger(result.status) ? result.status : 1;

  return {
    id: phase.id,
    commandSha256: sha256(phase.command),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Date.now() - started,
    exitCode,
    passed: exitCode === 0,
    skipped: false,
    reason: exitCode === 0 ? null : `Execution exited with code ${exitCode}.`,
    logPath: logPath.slice(process.cwd().length + 1),
    logSha256: sha256(readFileSync(logPath)),
  };
}

function buildJUnit(report) {
  const failures = report.scenarios.filter((scenario) => !scenario.passed).length;
  const cases = report.scenarios.map((scenario) => {
    const durationSeconds = (scenario.durationMs / 1000).toFixed(3);
    const failure = scenario.passed
      ? ''
      : `<failure message="${xmlEscape(scenario.reason ?? 'Security abuse scenario failed')}">${xmlEscape(JSON.stringify(scenario, null, 2))}</failure>`;
    return `  <testcase classname="security.abuse" name="${xmlEscape(scenario.id)}" time="${durationSeconds}">${failure}</testcase>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="security-abuse-gate" tests="${report.scenarios.length}" failures="${failures}" skipped="0" time="${(report.durationMs / 1000).toFixed(3)}">\n${cases}\n</testsuite>\n`;
}

mkdirSync(dirname(REPORT_PATH), { recursive: true });
mkdirSync(dirname(JUNIT_PATH), { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });

const overallStarted = Date.now();
let report;
try {
  const registry = parseJson(REGISTRY_PATH, 'Security abuse registry');
  validateRegistry(registry);

  const phaseResults = new Map();
  for (const phase of PHASES) {
    const result = runPhase(phase, phaseResults);
    phaseResults.set(phase.id, result);
  }

  const phases = [...phaseResults.values()];
  const scenarios = registry.scenarios.map((scenario) => {
    const requiredPhases = scenario.phaseIds.map((phaseId) => phaseResults.get(phaseId));
    const passed = requiredPhases.every((phase) => phase?.passed === true);
    return {
      id: scenario.id,
      phaseIds: scenario.phaseIds,
      evidence: scenario.evidence,
      passed,
      durationMs: requiredPhases.reduce((sum, phase) => sum + Number(phase?.durationMs ?? 0), 0),
      reason: passed
        ? null
        : requiredPhases.filter((phase) => !phase?.passed).map((phase) => `${phase?.id ?? 'missing'}: ${phase?.reason ?? 'failed'}`).join('; '),
    };
  });

  report = {
    schemaVersion: 1,
    repository: 'pachaninm-lab/pachanin-demo',
    commitSha: EXACT_HEAD,
    generatedAt: new Date().toISOString(),
    registrySha256: sha256(readFileSync(REGISTRY_PATH)),
    durationMs: Date.now() - overallStarted,
    phases,
    scenarios,
    passed: phases.every((phase) => phase.passed) && scenarios.every((scenario) => scenario.passed),
  };
} catch (error) {
  report = {
    schemaVersion: 1,
    repository: 'pachaninm-lab/pachanin-demo',
    commitSha: EXACT_HEAD,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - overallStarted,
    phases: [],
    scenarios: REQUIRED_SCENARIOS.map((id) => ({
      id,
      phaseIds: [],
      evidence: [],
      passed: false,
      durationMs: 0,
      reason: error instanceof Error ? error.message : String(error),
    })),
    passed: false,
    policyError: error instanceof Error ? error.message : String(error),
  };
}

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(JUNIT_PATH, buildJUnit(report));

if (!report.passed) {
  console.error('Security abuse gate failed.');
  for (const scenario of report.scenarios.filter((candidate) => !candidate.passed)) {
    console.error(`- ${scenario.id}: ${scenario.reason}`);
  }
  process.exit(1);
}

console.log(`Security abuse gate passed ${report.scenarios.length} mandatory scenarios for ${EXACT_HEAD}.`);