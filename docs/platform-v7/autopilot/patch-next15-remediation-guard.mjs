#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/p7-autopilot-guard.sh';
const branch = 'agent/ir-sec-next-15-5-16';
let text = readFileSync(path, 'utf8');

const scope = `NEXT15_REMEDIATION_SCOPE='apps/web/**
pnpm-lock.yaml
docs/platform-v7/autopilot/security-exceptions.json
scripts/p7-autopilot-guard.sh'

`;
const scopeAnchor = 'if [ "${GITHUB_HEAD_REF:-}" = "agent/harden-platform-v7-public-entry" ]';
if (!text.includes(scope)) {
  if (!text.includes(scopeAnchor)) throw new Error('Scope anchor is missing.');
  text = text.replace(scopeAnchor, `${scope}${scopeAnchor}`);
}

const branchGuard = `if [ "\${GITHUB_HEAD_REF:-}" = "${branch}" ]; then
  ALLOWED_CURRENT=$(printf '%s\\n%s\\n' "$ALLOWED_CURRENT" "$NEXT15_REMEDIATION_SCOPE")
fi

`;
const branchAnchor = `APPROVED_BRANCH_SCOPE=$(GITHUB_HEAD_REF="\${GITHUB_HEAD_REF:-}" node - <<'JS'`;
if (!text.includes(branchGuard)) {
  if (!text.includes(branchAnchor)) throw new Error('Branch-scope anchor is missing.');
  text = text.replace(branchAnchor, `${branchGuard}${branchAnchor}`);
}

const previousConditional = `if [ "\${GITHUB_HEAD_REF:-}" = "agent/ir-sec-transitive-runtime-remediation" ] || [ "\${GITHUB_HEAD_REF:-}" = "agent/ir-sec-opentelemetry-220" ]; then
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\\.json$|\\.env|.*\\.pem$|.*\\.key$)'
else
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\\.json$|pnpm-lock\\.yaml$|\\.env|.*\\.pem$|.*\\.key$)'
fi`;
const expandedConditional = `if [ "\${GITHUB_HEAD_REF:-}" = "agent/ir-sec-transitive-runtime-remediation" ] || [ "\${GITHUB_HEAD_REF:-}" = "agent/ir-sec-opentelemetry-220" ] || [ "\${GITHUB_HEAD_REF:-}" = "${branch}" ]; then
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\\.json$|\\.env|.*\\.pem$|.*\\.key$)'
else
  FORBIDDEN_ALWAYS='^(apps/landing/|package-lock\\.json$|pnpm-lock\\.yaml$|\\.env|.*\\.pem$|.*\\.key$)'
fi`;
if (!text.includes(expandedConditional)) {
  if (!text.includes(previousConditional)) throw new Error('Forbidden-path policy is missing.');
  text = text.replace(previousConditional, expandedConditional);
}

for (const required of [scope, branchGuard, expandedConditional]) {
  if (!text.includes(required)) throw new Error('Guard patch verification failed.');
}
writeFileSync(path, text);
console.log('Branch-specific Next.js 15 remediation guard patched.');
