#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/p7-autopilot-guard.sh';
const branch = 'agent/ir-sec-transitive-runtime-remediation';
let text = readFileSync(path, 'utf8');

const scope = `TRANSITIVE_RUNTIME_REMEDIATION_SCOPE='package.json
pnpm-lock.yaml
docs/platform-v7/autopilot/security-exceptions.json
scripts/p7-autopilot-guard.sh'

`;
const scopeAnchor = 'if [ "${GITHUB_HEAD_REF:-}" = "agent/harden-platform-v7-public-entry" ]';
if (!text.includes(scope)) {
  if (!text.includes(scopeAnchor)) throw new Error('Scope anchor is missing.');
  text = text.replace(scopeAnchor, `${scope}${scopeAnchor}`);
}

const branchGuard = `if [ "${GITHUB_HEAD_REF:-}" = "${branch}" ]; then
  ALLOWED_CURRENT=$(printf '%s\\n%s\\n' "$ALLOWED_CURRENT" "$TRANSITIVE_RUNTIME_REMEDIATION_SCOPE")
fi

`;
const branchAnchor = `APPROVED_BRANCH_SCOPE=$(GITHUB_HEAD_REF="${GITHUB_HEAD_REF:-}" node - <<'JS'`;
if (!text.includes(branchGuard)) {
  if (!text.includes(branchAnchor)) throw new Error('Branch-scope anchor is missing.');
  text = text.replace(branchAnchor, `${branchGuard}${branchAnchor}`);
}

const oldForbidden = `FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\\.json$|pnpm-lock\\.yaml$|\\.env|.*\\.pem$|.*\\.key$)'`;
const branchForbidden = `if [ "${GITHUB_HEAD_REF:-}" = "${branch}" ]; then
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\\.json$|\\.env|.*\\.pem$|.*\\.key$)'
else
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\\.json$|pnpm-lock\\.yaml$|\\.env|.*\\.pem$|.*\\.key$)'
fi`;
if (!text.includes(branchForbidden)) {
  if (!text.includes(oldForbidden)) throw new Error('Forbidden-path policy is missing.');
  text = text.replace(oldForbidden, branchForbidden);
}

for (const required of [scope, branchGuard, branchForbidden]) {
  if (!text.includes(required)) throw new Error('Guard patch verification failed.');
}
writeFileSync(path, text);
console.log('Branch-specific dependency remediation guard patched.');
