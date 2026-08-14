#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-gekta-first-user-mail-diagnostic.yml';
const scriptPath = 'scripts/production-gekta-first-user-mail-diagnostic.sh';
const scopePath = 'docs/platform-v7/autopilot/scopes/gekta-first-user-mail-diagnostic-31800628106-3072.json';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));

const need = (text, marker, label) => {
  if (!text.includes(marker)) throw new Error(`${label}: missing ${JSON.stringify(marker)}`);
};

for (const marker of [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "/production gekta-first-user-mail-diagnose 31800628106 current-main",
  "SOURCE_RUN_ID: '31800628106'",
  "SOURCE_DEPLOYED_SHA: 'f4cca72a0716c0fe2c94fd5e838d18be774b9812'",
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_MAILBOX_IMAP_PASSWORD',
  'PC_PROD_SSH_HOST_FINGERPRINT',
  'bash scripts/production-gekta-first-user-mail-diagnostic.sh',
]) need(workflow, marker, 'workflow');

for (const marker of [
  "COMMAND='/production gekta-first-user-mail-diagnose 31800628106 current-main'",
  'git merge-base --is-ancestor "$SOURCE_DEPLOYED_SHA" "$TARGET_SHA"',
  'docker inspect "$web_id" "$api_id"',
  'REGISTRATION_DELIVERY_KEY',
  'gekta_registration_email_delivery_result',
  'gekta_registration_public_request_accepted',
  'docker logs --since "$since" --until "$until"',
  'client.select(folder, readonly=True)',
  "folders.append('INBOX')",
  'canonical_address',
  'PRODUCTION_MUTATION=NONE',
  'mail send / resend: \\`NONE\\`',
  'raw logs / raw mailbox: \\`NOT_PUBLISHED\\`',
  'StrictHostKeyChecking=yes',
]) need(script, marker, 'script');

for (const forbidden of [
  /\bdocker\s+(?:run|rm|start|stop|restart|kill|update|compose\s+up)\b/iu,
  /\b(?:psql|prisma)\b/iu,
  /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:auth\.|public\.|gekta_)/iu,
  /\/api\/gekta\/auth\/register(?:\/resend)?/iu,
  /\bsmtplib\b/iu,
  /\bMAIL FROM\b/iu,
  /\bRCPT TO\b/iu,
  /StrictHostKeyChecking=no/iu,
  /UserKnownHostsFile=\/dev\/null/iu,
]) {
  if (forbidden.test(`${workflow}\n${script}`)) throw new Error(`forbidden capability ${forbidden}`);
}

const expectedPaths = [workflowPath, scriptPath, 'scripts/check-production-gekta-first-user-mail-diagnostic.mjs', scopePath].sort();
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope schemaVersion');
if (scope.branch !== 'diag/gekta-first-user-mail-31800628106-3072') throw new Error('scope branch');
if (scope.issue !== 3072 || scope.sourceRun !== 31800628106) throw new Error('scope authority');
if (scope.sourceDeployedSha !== 'f4cca72a0716c0fe2c94fd5e838d18be774b9812') throw new Error('scope source revision');
if (JSON.stringify([...scope.allowedPaths].sort()) !== JSON.stringify(expectedPaths)) throw new Error('scope allowed paths');
for (const [key, expected] of Object.entries({
  productionMutation: false,
  databaseMutation: false,
  runtimeMutation: false,
  deploymentMutation: false,
  mailSend: false,
  resend: false,
  imapReadOnly: true,
  containerLogReadOnly: true,
  containerEnvComparisonReadOnly: true,
  piiOutput: false,
  credentialOutput: false,
  rawLogOutput: false,
  rawMailboxOutput: false,
  ownerOnly: true,
  exactMainGuard: true,
  newRecurringCostRub: 0,
})) {
  if (scope.boundaries?.[key] !== expected) throw new Error(`scope boundary ${key}`);
}

console.log('PASS: bounded read-only Gekta first-user mail diagnostic preserves exact-main and pinned deployed-revision authority while classifying delivery-key parity, BFF mail path, configured-vs-INBOX mailbox location, and verification-link shape without resend, runtime mutation, PII or credential disclosure.');
