#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function replaceOne(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`${label}: expected source fragment not found`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`${label}: source fragment is not unique`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

function writeIfChanged(path, original, next) {
  if (next === original) return false;
  writeFileSync(path, next);
  console.log(`updated ${path}`);
  return true;
}

const wrapperPath = 'scripts/pc-tai-release-controller.sh';
const syncPath = 'scripts/pc-tai-controller-sync.sh';

{
  const original = readFileSync(wrapperPath, 'utf8');
  let text = original;
  text = replaceOne(
    text,
    "unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK",
    "unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK GIT_ASKPASS GIT_TERMINAL_PROMPT PC_GITHUB_TOKEN_FILE",
    `${wrapperPath}: sanitize inherited Git auth`,
  );
  const failBlock = `fail() {\n  printf 'ERROR_CODE=%s\\n' "$1" >&2\n  exit "\${2:-1}"\n}\n`;
  const authBlock = `${failBlock}\nrepo_auth_dir=''\n\nclear_repo_auth() {\n  unset GIT_ASKPASS GIT_TERMINAL_PROMPT PC_GITHUB_TOKEN_FILE\n  if [[ -n "\${repo_auth_dir:-}" ]]; then\n    [[ "$repo_auth_dir" == "$STATE_ROOT/controller-jobs/git-auth-$RUN_ID" ]] || return 90\n    rm -f -- "$repo_auth_dir/token" "$repo_auth_dir/askpass.sh" || return 91\n    rmdir -- "$repo_auth_dir" || return 92\n    repo_auth_dir=''\n  fi\n}\n\nprepare_repo_auth() {\n  local token='' token_file askpass\n  IFS= read -r token || [[ -n "$token" ]] || fail REPOSITORY_READ_TOKEN_MISSING 13\n  [[ "$token" =~ ^[A-Za-z0-9_-]{20,512}$ ]] || fail REPOSITORY_READ_TOKEN_INVALID 14\n  repo_auth_dir="$STATE_ROOT/controller-jobs/git-auth-$RUN_ID"\n  [[ ! -e "$repo_auth_dir" && ! -L "$repo_auth_dir" ]] || fail REPOSITORY_AUTH_STATE_EXISTS 15\n  install -d -m 0700 -o root -g root "$repo_auth_dir"\n  token_file="$repo_auth_dir/token"\n  askpass="$repo_auth_dir/askpass.sh"\n  ( umask 077; printf '%s' "$token" > "$token_file" )\n  unset token\n  cat > "$askpass" <<'GIT_ASKPASS_SH'\n#!/bin/sh\ncase "\${1:-}" in\n  *Username*) printf '%s\\n' 'x-access-token' ;;\n  *Password*) cat "\${PC_GITHUB_TOKEN_FILE:?}" ;;\n  *) exit 1 ;;\nesac\nGIT_ASKPASS_SH\n  chmod 0700 "$askpass"\n  export GIT_ASKPASS="$askpass"\n  export GIT_TERMINAL_PROMPT=0\n  export PC_GITHUB_TOKEN_FILE="$token_file"\n}\n`;
  text = replaceOne(text, failBlock, authBlock, `${wrapperPath}: install private Git auth functions`);
  text = replaceOne(
    text,
    `on_exit() {\n  local rc="$?" restore_rc=0\n  trap - EXIT\n  restore_runner_boundary || restore_rc="$?"`,
    `on_exit() {\n  local rc="$?" restore_rc=0\n  trap - EXIT\n  clear_repo_auth || true\n  restore_runner_boundary || restore_rc="$?"`,
    `${wrapperPath}: cleanup auth on exit`,
  );
  text = replaceOne(
    text,
    `install -d -m 0750 -o root -g pcactions "$OUTPUT_ROOT"\nif [[ ! -d "$REPOSITORY_ROOT/.git" ]]; then`,
    `install -d -m 0750 -o root -g pcactions "$OUTPUT_ROOT"\ninstall -d -m 0700 -o root -g root "$STATE_ROOT/controller-jobs"\nprepare_repo_auth\nif [[ ! -d "$REPOSITORY_ROOT/.git" ]]; then`,
    `${wrapperPath}: authenticate clone/fetch`,
  );
  text = replaceOne(
    text,
    `[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 24\n\nreadonly CORE_PATH=`,
    `[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 24\nclear_repo_auth || fail REPOSITORY_AUTH_CLEANUP_FAILED 29\n\nreadonly CORE_PATH=`,
    `${wrapperPath}: erase Git credential before executing core`,
  );
  writeIfChanged(wrapperPath, original, text);
}

{
  const original = readFileSync(syncPath, 'utf8');
  let text = original;
  text = replaceOne(
    text,
    "unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK",
    "unset BASH_ENV ENV CDPATH GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 SSH_AUTH_SOCK GIT_ASKPASS GIT_TERMINAL_PROMPT PC_GITHUB_TOKEN_FILE",
    `${syncPath}: sanitize inherited Git auth`,
  );
  text = replaceOne(
    text,
    "readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'\nreadonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'",
    "readonly REPOSITORY_URL='https://github.com/pachaninm-lab/pachanin-demo.git'\nreadonly STATE_ROOT='/var/lib/pc-release-authority'\nreadonly REPOSITORY_ROOT='/var/lib/pc-release-authority/repository'",
    `${syncPath}: define protected state root`,
  );
  const failBlock = `fail() {\n  printf 'TAI_CONTROLLER_SYNC_ERROR=%s\\n' "$1" >&2\n  exit "\${2:-1}"\n}\n`;
  const authBlock = `${failBlock}\nrepo_auth_dir=''\n\nclear_repo_auth() {\n  unset GIT_ASKPASS GIT_TERMINAL_PROMPT PC_GITHUB_TOKEN_FILE\n  if [[ -n "\${repo_auth_dir:-}" ]]; then\n    [[ "$repo_auth_dir" == "$STATE_ROOT/controller-jobs/git-auth-sync-$RUN_ID" ]] || return 90\n    rm -f -- "$repo_auth_dir/token" "$repo_auth_dir/askpass.sh" || return 91\n    rmdir -- "$repo_auth_dir" || return 92\n    repo_auth_dir=''\n  fi\n}\n\nprepare_repo_auth() {\n  local token='' token_file askpass\n  IFS= read -r token || [[ -n "$token" ]] || fail REPOSITORY_READ_TOKEN_MISSING 48\n  [[ "$token" =~ ^[A-Za-z0-9_-]{20,512}$ ]] || fail REPOSITORY_READ_TOKEN_INVALID 49\n  install -d -m 0700 -o root -g root "$STATE_ROOT/controller-jobs"\n  repo_auth_dir="$STATE_ROOT/controller-jobs/git-auth-sync-$RUN_ID"\n  [[ ! -e "$repo_auth_dir" && ! -L "$repo_auth_dir" ]] || fail REPOSITORY_AUTH_STATE_EXISTS 50\n  install -d -m 0700 -o root -g root "$repo_auth_dir"\n  token_file="$repo_auth_dir/token"\n  askpass="$repo_auth_dir/askpass.sh"\n  ( umask 077; printf '%s' "$token" > "$token_file" )\n  unset token\n  cat > "$askpass" <<'GIT_ASKPASS_SH'\n#!/bin/sh\ncase "\${1:-}" in\n  *Username*) printf '%s\\n' 'x-access-token' ;;\n  *Password*) cat "\${PC_GITHUB_TOKEN_FILE:?}" ;;\n  *) exit 1 ;;\nesac\nGIT_ASKPASS_SH\n  chmod 0700 "$askpass"\n  export GIT_ASKPASS="$askpass"\n  export GIT_TERMINAL_PROMPT=0\n  export PC_GITHUB_TOKEN_FILE="$token_file"\n}\n\nauth_exit() { clear_repo_auth || true; }\ntrap auth_exit EXIT\n`;
  text = replaceOne(text, failBlock, authBlock, `${syncPath}: install private Git auth functions`);
  text = replaceOne(
    text,
    `[[ "$(git -C "$REPOSITORY_ROOT" remote get-url origin)" == "$REPOSITORY_URL" ]] || fail PROTECTED_REPOSITORY_REMOTE_INVALID 15\n\nexec 9>"$CONTROLLER_LOCK"`,
    `[[ "$(git -C "$REPOSITORY_ROOT" remote get-url origin)" == "$REPOSITORY_URL" ]] || fail PROTECTED_REPOSITORY_REMOTE_INVALID 15\nprepare_repo_auth\n\nexec 9>"$CONTROLLER_LOCK"`,
    `${syncPath}: authenticate protected fetch`,
  );
  text = replaceOne(
    text,
    `[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 19\n\nexpected_source=`,
    `[[ -z "$(git -C "$REPOSITORY_ROOT" status --porcelain=v1)" ]] || fail PROTECTED_CHECKOUT_DIRTY 19\nclear_repo_auth || fail REPOSITORY_AUTH_CLEANUP_FAILED 51\n\nexpected_source=`,
    `${syncPath}: erase Git credential before controller mutation`,
  );
  text = replaceOne(
    text,
    `cleanup() {\n  local rc="$?"\n  trap - EXIT`,
    `cleanup() {\n  local rc="$?"\n  trap - EXIT\n  clear_repo_auth || true`,
    `${syncPath}: retain auth cleanup after trap replacement`,
  );
  writeIfChanged(syncPath, original, text);
}

const workflowDir = '.github/workflows';
const workflowFiles = readdirSync(workflowDir)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => join(workflowDir, name));
const actionPattern = /^(\s*)(sudo(?:\s+-n)?\s+\/usr\/local\/sbin\/pc-tai-release-controller\s+(?:preflight|activate|finalize-activation|deploy|repair-runtime-role)\b[^\n]*)$/gm;
let patchedActionCalls = 0;
for (const path of workflowFiles) {
  const original = readFileSync(path, 'utf8');
  let text = original.replace(actionPattern, (_match, indent, command) => {
    patchedActionCalls += 1;
    return `${indent}printf '%s\\n' '\${{ github.token }}' | ${command}`;
  });

  if (path.endsWith('tai-owner-controller-sync-command.yml')) {
    const marker = '"chmod 0700 /tmp/pc-tai-controller-sync-${GITHUB_RUN_ID}.sh && /tmp/pc-tai-controller-sync-${GITHUB_RUN_ID}.sh';
    const markerIndex = text.indexOf(marker);
    if (markerIndex < 0) throw new Error(`${path}: exact controller-sync execution marker missing`);
    const sshNeedle = '          ssh -i "$HOME/.ssh/id_pc_prod" -p "$PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes "$USER@$HOST" \\\n';
    const sshIndex = text.lastIndexOf(sshNeedle, markerIndex);
    if (sshIndex < 0) throw new Error(`${path}: controller-sync SSH invocation missing`);
    const replacement = '          printf \'%s\\n\' \'${{ github.token }}\' | ssh -i "$HOME/.ssh/id_pc_prod" -p "$PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes "$USER@$HOST" \\\n';
    text = text.slice(0, sshIndex) + replacement + text.slice(sshIndex + sshNeedle.length);
  }

  writeIfChanged(path, original, text);
}

if (patchedActionCalls < 1) throw new Error('No production release-controller action invocations were patched');

let residual = [];
for (const path of workflowFiles) {
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (/sudo(?:\s+-n)?\s+\/usr\/local\/sbin\/pc-tai-release-controller\s+(?:preflight|activate|finalize-activation|deploy|repair-runtime-role)\b/.test(line)
      && !line.includes('github.token')) {
      residual.push(`${path}: ${line.trim()}`);
    }
  }
}
if (residual.length) throw new Error(`Unauthenticated controller call sites remain:\n${residual.join('\n')}`);

const wrapper = readFileSync(wrapperPath, 'utf8');
const sync = readFileSync(syncPath, 'utf8');
for (const [path, text] of [[wrapperPath, wrapper], [syncPath, sync]]) {
  for (const required of ['GIT_ASKPASS', 'GIT_TERMINAL_PROMPT=0', 'PC_GITHUB_TOKEN_FILE', 'x-access-token', 'clear_repo_auth']) {
    if (!text.includes(required)) throw new Error(`${path}: missing ${required}`);
  }
  if (/https:\/\/[^\s/@]+@github\.com/.test(text)) throw new Error(`${path}: credential embedded in repository URL`);
  if (/github_pat_|gh[pousr]_[A-Za-z0-9]/.test(text)) throw new Error(`${path}: literal GitHub credential detected`);
}

console.log(`private repository transport prepared across ${patchedActionCalls} controller action call site(s)`);
