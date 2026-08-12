#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/production-p0-reviewer-password-reset-dispatch.yml';
const scriptPath = 'scripts/production-p0-reviewer-password-reset-dispatch.sh';
const migrationPath = 'apps/api/prisma/migrations/20260812162000_p0_reviewer_password_reset_dispatch/migration.sql';

const workflow = fs.readFileSync(workflowPath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const all = `${workflow}\n${script}\n${migration}`;

const requireAll = (source, needles, label) => {
  for (const needle of needles) {
    if (!source.includes(needle)) throw new Error(`${label} missing required boundary: ${needle}`);
  }
};

requireAll(workflow, [
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.actor == github.repository_owner",
  "github.triggering_actor == github.repository_owner",
  "/production p0-reviewer-password-reset current-main",
  "bash scripts/production-p0-reviewer-password-reset-dispatch.sh",
], 'workflow');

requireAll(script, [
  "set -Eeuo pipefail",
  "StrictHostKeyChecking=yes",
  "PC_PROD_SSH_HOST_FINGERPRINT",
  "guard_main",
  "org.opencontainers.image.revision",
  "AUTH_DATABASE_URL",
  "pc_auth_runtime",
  "auth.resolve_single_reviewer_password_reset_subject()",
  "/platform-v7/register?lang=ru&reviewer-reset=",
  "/api/auth/forgot-password",
  "pc_csrf_token",
  "x-csrf-token",
  "PASSWORD_RESET_CHALLENGE_AND_AUDIT_ONLY",
  "REVIEWER_PASSWORD_RESET_EMAIL_ACTION_REQUIRED",
], 'dispatch script');

requireAll(migration, [
  "pc_reviewer_password_reset_dispatch_authority",
  "NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE",
  "FORCE ROW LEVEL SECURITY",
  "auth.resolve_single_reviewer_password_reset_subject()",
  "assignment.role = 'PLATFORM_OWNER'",
  "organization.\"status\" = 'VERIFIED'",
  "COALESCE(subject.\"passwordHash\", '') !~",
  "resolved_count <> 1",
  "REVOKE ALL ON FUNCTION auth.resolve_single_reviewer_password_reset_subject() FROM PUBLIC",
  "GRANT EXECUTE ON FUNCTION auth.resolve_single_reviewer_password_reset_subject()",
  "has_table_privilege('pc_auth_runtime', 'public.users', 'SELECT')",
], 'migration');

const forbidden = [
  'PC_P0_REVIEWER_EMAIL',
  'PC_P0_REVIEWER_PASSWORD',
  'PC_P0_REVIEWER_TOTP_SECRET',
  'BOOTSTRAP_PLATFORM_OWNER_EMAIL',
  'CREATE_PLATFORM_OWNER:',
  'UPDATE public.\"users\"',
  'UPDATE public.users',
  'UPDATE auth.credential_states',
  'INSERT INTO auth.staff_assignments',
  'UPDATE auth.staff_assignments',
  'INSERT INTO public.\"user_orgs\"',
  'UPDATE public.\"user_orgs\"',
  'set -x',
];
for (const needle of forbidden) {
  if (workflow.includes(needle) || script.includes(needle)) {
    throw new Error(`dispatch surface contains forbidden credential/mutation pattern: ${needle}`);
  }
}

if (/secrets\.[A-Z0-9_]*(REVIEWER|PASSWORD|TOTP|MFA)/.test(workflow)) {
  throw new Error('workflow must not receive reviewer/password/TOTP/MFA secrets');
}

if (migration.includes('BYPASSRLS') && !migration.includes('NOBYPASSRLS')) {
  throw new Error('dispatch authority must never bypass RLS');
}

if (!/production mutation: \\`PASSWORD_RESET_CHALLENGE_AND_AUDIT_ONLY\\`/.test(script)) {
  throw new Error('published evidence must declare the only permitted mutation');
}

if (!all.includes('reviewer email/password/token/TOTP published')) {
  throw new Error('evidence contract must explicitly state that reviewer secrets are not published');
}

console.log('PRODUCTION_P0_REVIEWER_PASSWORD_RESET_DISPATCH_CONTRACT=PASS');
