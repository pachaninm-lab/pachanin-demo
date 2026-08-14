import fs from 'node:fs';
import crypto from 'node:crypto';

process.on('uncaughtException', (error) => {
  const message = String(error?.message || 'unknown contract failure')
    .replace(/[\r\n%]/g, ' ')
    .slice(0, 240);
  console.error(`::error title=PC-CROP ancestor authority contract::${message}`);
  process.exit(1);
});

const workflowPath = '.github/workflows/production-p0-reviewer-password-reset-ancestor-authority.yml';
const wrapperPath = 'scripts/production-p0-reviewer-password-reset-ancestor-authority.sh';
const basePath = 'scripts/production-p0-reviewer-password-reset-request.sh';
const command = '/production p0-reviewer-reset-request ancestor-authorized-current-main';
const expectedBaseBlob = 'cbfa6695df00b7b536d153a88e55626d66281063';

const read = (path) => fs.readFileSync(path, 'utf8');
const workflow = read(workflowPath);
const wrapper = read(wrapperPath);
const base = read(basePath);

const requireAll = (label, haystack, needles) => {
  for (const needle of needles) {
    if (!haystack.includes(needle)) throw new Error(`${label} missing: ${needle}`);
  }
};
const rejectAll = (label, haystack, needles) => {
  for (const needle of needles) {
    if (haystack.includes(needle)) throw new Error(`${label} forbidden: ${needle}`);
  }
};

const blobHeader = Buffer.from(`blob ${Buffer.byteLength(base)}\0`);
const baseBlob = crypto.createHash('sha1').update(blobHeader).update(base).digest('hex');
if (baseBlob !== expectedBaseBlob) throw new Error(`base reset script blob changed: ${baseBlob}`);

requireAll('workflow', workflow, [
  'issue_comment:',
  'pull_request:',
  'push:',
  command,
  'github.event.issue.number == 3072',
  'github.event.comment.user.login == github.repository_owner',
  'github.actor == github.repository_owner',
  'github.triggering_actor == github.repository_owner',
  'scripts/check-production-p0-reviewer-password-reset-ancestor-authority.mjs',
  'scripts/production-p0-reviewer-password-reset-ancestor-authority.sh',
  'PC_PROD_SSH_HOST_FINGERPRINT',
]);
rejectAll('workflow', workflow, [
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
]);

requireAll('wrapper', wrapper, [
  `COMMAND='${command}'`,
  `BASE_BLOB_SHA='${expectedBaseBlob}'`,
  'git hash-object "$BASE_SCRIPT"',
  'git merge-base --is-ancestor "$ACTIVE_SHA" "$TARGET_SHA"',
  'ACTIVE_REVISION_PREFLIGHT_FAILED',
  'ACTIVE_REVISION_NOT_ANCESTOR',
  'StrictHostKeyChecking=yes',
  'UserKnownHostsFile="$known_hosts"',
  '[[ "$api_revision" =~ ^[0-9a-f]{40}$ && "$web_revision" == "$api_revision" ]]',
  'stale revision guard cardinality invalid',
  'Recheck the exact ancestor-authorized runtime immediately before the only POST.',
  '[[ "$api_revision_recheck" ==',
  'PC_P0_ANCESTOR_AUTHORITY=',
  'production mutation: \\`NONE_OR_NORMAL_PASSWORD_RESET_REQUEST_ONLY\\`',
]);
rejectAll('wrapper', wrapper, [
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP',
  'StrictHostKeyChecking=no',
  'UserKnownHostsFile=/dev/null',
  'UPDATE public."users"',
  'INSERT INTO public."users"',
  'DELETE FROM public."users"',
  '/api/auth/forgot-password',
  '/platform-v7/forgot-password',
]);

const oldGuard = `if [[ "$api_revision" != "$target_sha" || "$web_revision" != "$target_sha" ]]; then\n  printf 'REMOTE_PARITY_FAILED\\n' >&2\n  exit 1\nfi`;
if (base.split(oldGuard).length !== 2) throw new Error('base stale guard cardinality must be exactly one');
if ((base.match(/started_epoch="\$\(date \+%s\)"/g) || []).length !== 1) {
  throw new Error('base pre-POST anchor cardinality must be exactly one');
}
requireAll('base reset surface', base, [
  'post_status="$(curl',
  '--data-binary "@$request_body"',
  '"$live_base/api/auth/forgot-password"',
  '[[ "$post_status" == \'202\' ]]',
  '"accepted"[[:space:]]*:[[:space:]]*true',
  'password_reset_delivery_result',
  '"delivered"[[:space:]]*:[[:space:]]*true',
]);

console.log('production P0 reviewer password-reset ancestor authority contract PASS');