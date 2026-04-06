import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const steps = [
  ['domain_typecheck', 'tsc -p packages/domain-core/tsconfig.json --noEmit'],
  ['shared_verify', 'tsc -p tsconfig.shared-verify.json --noEmit'],
  ['api_verify_offline', 'tsc -p tsconfig.api-verify.json --noEmit'],
  ['web_verify_offline', 'tsc -p tsconfig.web-verify.json --noEmit'],
  ['archive_local_gates', 'node ./scripts/run-archive-local-gates.mjs'],
  ['repo_static_audit', 'node ./scripts/audit-static-repo-integrity.mjs'],
  ['preintegration_pack', 'node ./scripts/build-preintegration-evidence-pack.mjs'],
  ['critical_flow_audit', 'node ./scripts/audit-critical-flows.mjs'],
  ['role_contract_audit', 'node ./scripts/audit-role-contract-consistency.mjs'],
  ['fallback_audit', 'node ./scripts/audit-fallback-surfaces.mjs']
];

const results = [];
for (const [name, command] of steps) {
  try {
    execSync(command, { stdio: 'pipe', cwd: process.cwd(), shell: '/bin/bash' });
    results.push({ name, status: 'PASS' });
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      command,
      output: String(error?.stdout || error?.stderr || error?.message || '').slice(0, 8000),
    });
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  passCount: results.filter((item) => item.status === 'PASS').length,
  failCount: results.filter((item) => item.status === 'FAIL').length,
  results,
};
mkdirSync('./var', { recursive: true });
writeFileSync('./var/repo-build-test-contour-report.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (summary.failCount > 0) process.exit(1);
