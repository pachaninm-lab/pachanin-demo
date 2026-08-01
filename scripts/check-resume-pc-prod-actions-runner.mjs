#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const scriptPath = 'scripts/resume-pc-prod-actions-runner.sh';
const script = readFileSync(scriptPath, 'utf8');
const violations = [];
const requireFragment = (fragment) => {
  if (!script.includes(fragment)) violations.push(`${scriptPath}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (pattern, message) => {
  if (pattern.test(script)) violations.push(`${scriptPath}: ${message}`);
};

for (const fragment of [
  '[[ "$(id -u)" -eq 0 ]]',
  'configured runner directory is unavailable',
  "encodings = ('utf-8-sig', 'utf-16', 'utf-16-le', 'utf-16-be')",
  'runner configuration cannot be decoded safely',
  'existing runner has a different identity',
  'private model host did not return SSH host keys',
  'private model host fingerprint mismatch',
  '(( $(grep -c . "$match" 2>/dev/null || true) >= 1 ))',
  'pcactions ALL=(root) NOPASSWD: /usr/local/sbin/pc-tai-release-controller',
  './svc.sh install "$RUNNER_USER"',
  'systemctl restart "$service_name"',
  'running runner process retained docker group',
  'DIRECT_DOCKER_AUTHORITY=false',
  'ROOT_AUTHORITY=restricted-controller-only',
]) requireFragment(fragment);

forbid(/RUNNER_REGISTRATION_TOKEN|--token\b/u, 'resume path must not require or consume a registration token');
forbid(/usermod\s+-aG\s+docker/u, 'docker group grant is forbidden');
forbid(/set\s+-[^\n]*x/iu, 'shell tracing is forbidden');
forbid(/NoNewPrivileges=true/u, 'NoNewPrivileges would block the restricted sudo controller');
forbid(/echo[^\n]*(?:token|secret|api[_-]?key)/iu, 'secret-like output is forbidden');

if (violations.length) {
  console.error('PC production runner resume contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log('PC production runner resume contract PASS: configured-runner only, multi-encoding safe decode, fingerprint-pinned model transport, restricted root controller and no direct Docker authority.');
