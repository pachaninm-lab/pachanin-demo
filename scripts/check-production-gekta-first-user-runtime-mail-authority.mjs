#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-gekta-first-user-acceptance.yml';
const checkerPath = 'scripts/check-production-gekta-first-user-runtime-mail-authority.mjs';
const scopePath = 'docs/platform-v7/autopilot/scopes/gekta-first-user-runtime-mail-authority-3072.json';
const workflow = fs.readFileSync(workflowPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

function need(text, marker, label) {
  if (!text.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
}

for (const marker of [
  'Rebind IMAP reader to active exact Web mail runtime',
  'PC_PROD_HOST: ${{ secrets.PC_PROD_HOST }}',
  'PC_PROD_SSH_USER: ${{ secrets.PC_PROD_SSH_USER }}',
  'PC_PROD_SSH_HOST_FINGERPRINT: ${{ secrets.PC_PROD_SSH_HOST_FINGERPRINT }}',
  'StrictHostKeyChecking=yes',
  "live_domain='xn----8sbjf4befbjgs9b.xn--p1ai'",
  "['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.service=web']",
  "['docker', 'inspect', ids[0]]",
  "revision != target",
  "host != 'mail.hosting.reg.ru' or port != '465'",
  "mailbox.endswith('@acceptance.xn----8sbjf4befbjgs9b.xn--p1ai')",
  "RUNTIME_MAILBOX|",
  '::add-mask::',
  "handle.write('PC_P0_IMAP_HOST=mail.hosting.reg.ru\\n')",
  "handle.write('PC_P0_IMAP_PORT=993\\n')",
  "handle.write(f'PC_P0_IMAP_USER={user}\\n')",
  "handle.write(f'PC_P0_IMAP_PASSWORD={password}\\n')",
  "handle.write('PC_P0_IMAP_FOLDER=INBOX\\n')",
  'unset runtime_mailbox user_b64 pass_b64',
  'GEKTA_RUNTIME_MAILBOX_AUTHORITY=READY',
  'node scripts/check-production-gekta-first-user-runtime-mail-authority.mjs',
]) need(workflow, marker, 'workflow');

const start = workflow.indexOf('      - name: Rebind IMAP reader to active exact Web mail runtime');
const end = workflow.indexOf('      - uses: pnpm/action-setup@v4', start);
if (start < 0 || end <= start) throw new Error('workflow: unable to isolate runtime-mail rebind step');
const step = workflow.slice(start, end);

for (const forbidden of [
  /set\s+-[^\n]*x/iu,
  /\bdocker\s+(?:run|rm|start|stop|restart|kill|update|compose\s+up)\b/iu,
  /\b(?:psql|prisma)\b/iu,
  /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:auth\.|public\.|gekta_)/iu,
  /\b(?:curl|wget)\b/iu,
  /StrictHostKeyChecking=no/iu,
  /UserKnownHostsFile=\/dev\/null/iu,
  /(?:echo|printf)[^\n]*(?:PC_SMTP_PASS|PC_P0_IMAP_PASSWORD)/iu,
  /tee[^\n]*(?:runtime_mailbox|PC_SMTP_PASS|PC_P0_IMAP_PASSWORD)/iu,
]) {
  if (forbidden.test(step)) throw new Error(`runtime-mail rebind contains forbidden operation ${forbidden}`);
}

for (const marker of [
  'try_slot "${PC_PROD_SSH_KEY:-}" || try_slot "${PC_PROD_SSH_PRIVATE_KEY:-}" || try_slot "${VPS_SSH_KEY:-}"',
  'ssh-keyscan -T 10 -p "$port" "$host"',
  'ssh-keygen -lf - -E sha256',
  '[[ "$(grep -c . "$match" || true)" == 1 ]]',
  '[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]',
]) need(step, marker, 'rebind step');

const expectedPaths = [workflowPath, checkerPath, scopePath].sort();
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schemaVersion');
if (scope.branch !== 'fix/gekta-first-user-runtime-mail-authority-3072') throw new Error('scope branch');
if (scope.issue !== 3072) throw new Error('scope issue');
if (scope.baseline?.commit !== '2e4d61379a4986cfe63260ea8c09710c4209be41') throw new Error('scope baseline');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) throw new Error('scope allowedPaths');
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') throw new Error('scope hosting');
for (const [key, expected] of Object.entries({
  productionMutation: false,
  databaseMutation: false,
  runtimeMutation: false,
  deploymentMutation: false,
  productCodeMutation: false,
  mailSendByRebind: false,
  credentialSource: 'ACTIVE_EXACT_WEB_RUNTIME_OVER_PINNED_SSH',
  ephemeralCredentialTransport: true,
  credentialOutput: false,
  credentialArtifact: false,
  piiOutput: false,
  ownerOnly: true,
  exactMainGuard: true,
  exactDeployedRevisionGuard: true,
  newRecurringCostRub: 0,
})) {
  if (scope.boundaries?.[key] !== expected) throw new Error(`scope boundary ${key}`);
}

console.log('PASS: owner-only Gekta first-user acceptance rebinds the IMAP reader to the exact running Web SMTP mailbox authority over pinned SSH, masks credentials before use, persists them only through ephemeral runner environment, and performs no production/runtime/deployment mutation in the rebind step.');
