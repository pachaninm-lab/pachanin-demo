#!/usr/bin/env node
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE_RUNNER_BLOB = 'e0b35654ee3cd72c5838377cf3a1bbc43d6897d6';
const BASE_CHECKER_BLOB = 'ac714118057399504a3e57330c02fe1a4b26e488';
const runnerPath = 'scripts/production-p0-all-role-registration.sh';

function gitBlob(sha) {
  const result = spawnSync('git', ['cat-file', 'blob', sha], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    throw new Error(`immutable blob unavailable: ${sha}`);
  }
  return result.stdout;
}

function replaceOne(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`patch cardinality ${label}=${count}`);
  return source.replace(oldValue, newValue);
}

function patchedRunnerSource() {
  let source = gitBlob(BASE_RUNNER_BLOB);
  source = replaceOne(
    source,
    `    const imported = await context.cookies(origin);\n    const importedNames = new Set(imported.filter((cookie) => cookie.value).map((cookie) => cookie.name));\n    for (const required of ['pc_access_token', 'pc_v7_cabinet']) {\n      if (!importedNames.has(required)) fail('P0_CHROMIUM_AUTH_COOKIE_MISSING');\n    }\n`,
    `    // Cookie enumeration is not an authentication authority. The two\n    // server-authoritative probes below consume the exact production cookies:\n    // /api/auth/me requires pc_access_token, while cabinet middleware requires\n    // the signed pc_v7_cabinet session. Either missing/invalid cookie therefore\n    // still fails closed without relying on BrowserContext.cookies() introspection.\n`,
    'chromium-server-authority',
  );
  source = replaceOne(
    source,
    '    "P0_CHROMIUM_AUTH_COOKIE_MISSING",\n',
    '',
    'obsolete-cookie-blocker-invariant',
  );
  source = replaceOne(
    source,
    `if s.count("for (const required of ['pc_access_token', 'pc_v7_cabinet'])") != 1:\n    raise SystemExit('CHROMIUM_REQUIRED_COOKIE_PROOF_CARDINALITY_INVALID')\n`,
    `if s.count("context.request.get(origin + '/api/auth/me'") != 1:\n    raise SystemExit('CHROMIUM_ACCESS_COOKIE_AUTHORITY_CARDINALITY_INVALID')\nif s.count('const cabinetResponse = await context.request.get(origin + route') != 1:\n    raise SystemExit('CHROMIUM_CABINET_COOKIE_AUTHORITY_CARDINALITY_INVALID')\nif 'P0_CHROMIUM_AUTH_COOKIE_MISSING' in s:\n    raise SystemExit('CHROMIUM_COOKIE_ENUMERATION_AUTHORITY_REMAINS')\n`,
    'chromium-server-authority-cardinality',
  );
  return source;
}

function patchedLegacyCheckerSource() {
  let source = gitBlob(BASE_CHECKER_BLOB);
  source = replaceOne(
    source,
    `  "for (const required of ['pc_access_token', 'pc_v7_cabinet'])",\n`,
    '',
    'legacy-cookie-enumeration-requirement',
  );
  return source;
}

const outerRunner = readFileSync(runnerPath, 'utf8');
for (const fragment of [
  `BASE_WRAPPER_BLOB='${BASE_RUNNER_BLOB}'`,
  "'CHROMIUM_SERVER_AUTHORITY'",
  "'CHROMIUM_OBSOLETE_COOKIE_BLOCKER_INVARIANT'",
  "'CHROMIUM_SERVER_AUTHORITY_CARDINALITY'",
  'P0_ALL_ROLE_CHROMIUM_SERVER_AUTHORITY_WRAPPER=PASS',
]) {
  if (!outerRunner.includes(fragment)) throw new Error(`outer runner missing ${fragment}`);
}

const effectiveRunner = patchedRunnerSource();
if (effectiveRunner.includes('P0_CHROMIUM_AUTH_COOKIE_MISSING')) {
  throw new Error('obsolete BrowserContext.cookies() auth authority remains');
}
for (const fragment of [
  "context.request.get(origin + '/api/auth/me'",
  'P0_CHROMIUM_IMPORTED_SESSION_INVALID',
  'P0_CHROMIUM_IMPORTED_SESSION_CONTEXT_INVALID',
  'const cabinetResponse = await context.request.get(origin + route',
  'P0_CHROMIUM_SERVER_SESSION_REJECTED',
  'P0_CHROMIUM_SERVER_ROLE_REDIRECT',
  'maxRedirects: 0',
]) {
  if (!effectiveRunner.includes(fragment)) throw new Error(`server-authoritative proof missing ${fragment}`);
}
if ((effectiveRunner.match(/maxRedirects: 0/gu) || []).length !== 2) {
  throw new Error('server-authoritative redirect proof cardinality invalid');
}

const outerSyntax = spawnSync('bash', ['-n', runnerPath], { encoding: 'utf8' });
if (outerSyntax.status !== 0) throw new Error(`outer runner syntax failed: ${outerSyntax.stderr.trim()}`);
const validate = spawnSync('bash', [runnerPath], {
  encoding: 'utf8',
  env: { ...process.env, PC_P0_ALL_ROLE_IDNA_VALIDATE_ONLY: '1' },
});
if (validate.status !== 0) {
  throw new Error(`effective runner validation failed: ${validate.stderr.trim()}`);
}
for (const marker of [
  'P0_ALL_ROLE_CHROMIUM_SERVER_AUTHORITY_WRAPPER=PASS',
  'P0_ALL_ROLE_CORE_BLOB=PASS',
  'P0_ALL_ROLE_CHROMIUM_COOKIE_HANDOFF=PASS',
  'P0_ALL_ROLE_REVIEWER_CREDENTIAL_BAN=PASS',
]) {
  if (!validate.stdout.includes(marker)) throw new Error(`validation marker missing ${marker}`);
}

const tempRoot = mkdtempSync(join(process.cwd(), '.p0-server-authority-check-'));
try {
  const paths = [
    '.github/workflows/production-p0-all-role-registration.yml',
    'docs/ops/production-p0-all-role-registration.md',
    'docs/platform-v7/autopilot/scopes/production-p0-all-role-registration-3785.json',
  ];
  for (const path of paths) {
    const target = join(tempRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(path, target);
  }
  const tempRunner = join(tempRoot, runnerPath);
  mkdirSync(dirname(tempRunner), { recursive: true });
  writeFileSync(tempRunner, effectiveRunner, { mode: 0o700 });
  const tempChecker = join(tempRoot, 'scripts/check-production-p0-all-role-registration.mjs');
  writeFileSync(tempChecker, patchedLegacyCheckerSource(), { mode: 0o600 });

  const legacy = spawnSync(process.execPath, ['scripts/check-production-p0-all-role-registration.mjs'], {
    cwd: tempRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (legacy.status !== 0) {
    throw new Error(`baseline contract regression: ${(legacy.stderr || legacy.stdout).trim()}`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log('Production P0 all-role registration contract PASS: Chromium handoff is judged by the canonical server consumers of pc_access_token and signed pc_v7_cabinet, not BrowserContext.cookies() enumeration; all prior bounded contract guards remain enforced.');
