#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const files = {
  workflow: '.github/workflows/production-gekta-first-user-acceptance.yml',
  executor: 'scripts/production-gekta-first-user-acceptance.mjs',
  checker: 'scripts/check-production-gekta-first-user-acceptance.mjs',
  live: 'scripts/production-web-live-acceptance.sh',
  runbook: 'docs/ops/production-gekta-first-user-acceptance.md',
  scope: 'docs/platform-v7/autopilot/scopes/production-gekta-runtime-20260813.json',
};

const source = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, readFileSync(file, 'utf8')]));

function requireAll(name, values) {
  for (const value of values) {
    if (!source[name].includes(value)) throw new Error(`${name}: missing ${JSON.stringify(value)}`);
  }
}

function forbid(name, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(source[name])) throw new Error(`${name}: forbidden ${pattern}`);
  }
}

requireAll('workflow', [
  'name: Production Gekta First-User Acceptance',
  'issue_comment:',
  "github.event.issue.number == 3072",
  "github.event.comment.user.login == github.repository_owner",
  "github.event.comment.body == '/production gekta-first-user current-main'",
  'github.event.pull_request.head.sha || github.sha',
  'Resolve exact current main',
  'Verify exact deployed revision before journey',
  'PC_PROD_P0_MAILBOX_EMAIL_TEMPLATE',
  'PC_PROD_P0_MAILBOX_IMAP_HOST',
  'PC_PROD_P0_MAILBOX_IMAP_USER',
  'PC_PROD_P0_MAILBOX_IMAP_PASSWORD',
  'Install Chromium runtime',
  'Execute first-user journey and wait for owner ceremony',
  'timeout-minutes: 90',
  'GEKTA_OWNER_CEREMONY=WAITING',
  'synthetic test phone',
  'https://процент-агро.рф/gekta/console',
  'existing PLATFORM_OWNER session with fresh MFA',
  'Enforce bounded evidence',
  'Guard exact main before artifact publication',
  'Remove protected acceptance material',
  'GEKTA_FIRST_USER_ACCEPTANCE=PASS',
]);

forbid('workflow', [
  /workflow_dispatch:/u,
  /PC_PROD_GE?KTA_(?:OWNER|REVIEWER)_(?:EMAIL|PASSWORD|TOTP|SECRET)/iu,
  /(?:echo|printf)[^\n]*(?:IMAP_PASSWORD|MFA_SECRET|VERIFY_TOKEN|BACKUP_CODES)/iu,
  /continue-on-error:\s*true[\s\S]{0,180}Execute first-user journey/iu,
]);

requireAll('executor', [
  "LIVE_BASE === 'https://xn----8sbjf4befbjgs9b.xn--p1ai'",
  "REPOSITORY === 'pachaninm-lab/pachanin-demo'",
  'assertExactMain();',
  '/manifest-pc-deploy.json?gekta-acceptance=',
  "requireFromWeb('@playwright/test')",
  "page.locator('[data-gekta-consent-accept=\"true\"]')",
  "page.getByRole('button', { name: 'Отправить', exact: true })",
  "GEKTA_LIVE_ANONYMOUS_ANSWER=PASS",
  "fetch('/api/agro-chat?stream=1'",
  "'x-gekta-answer-ticket': ticket",
  "body.includes('\"event\":\"done\"') && body.includes('\"complete\":true')",
  'usage.data?.entitlement?.remaining === 8 - index',
  'GEKTA_DURABLE_ANONYMOUS_ANSWER_FAILED',
  "GEKTA_ANONYMOUS_TEN_ANSWER_GATE=PASS",
  "page.locator('[data-gekta-registration-cta=\"true\"]')",
  "GEKTA_SEPARATE_CONSENTS_MISSING",
  "PC_P0_IMAP_PASSWORD",
  "imaplib.IMAP4_SSL",
  "/api/gekta/auth/email/verify",
  "page.getByRole('button', { name: 'Подтвердить email', exact: true })",
  "page.getByRole('heading', { name: 'Защитите аккаунт', exact: true })",
  "GEKTA_MANDATORY_MFA=PASS",
  "trial.days > 29 && trial.days <= 30.1",
  "phone.data?.state === 'DECLARED'",
  "/api/gekta/account/conversations?search=",
  "/api/gekta/account/projects",
  "GEKTA_OWNER_CEREMONY=WAITING",
  "GEKTA_OWNER_GRANT_7_DAYS=PASS",
  "GEKTA_OWNER_GRANT_30_DAYS=PASS",
  "GEKTA_OWNER_GRANT_LIFETIME=PASS",
  "publishOwnerProgress('7_DAYS')",
  "publishOwnerProgress('30_DAYS')",
  "publishOwnerProgress('LIFETIME')",
  "page.getByRole('button', { name: 'Выйти', exact: true })",
  "page.getByRole('tab', { name: 'Вход', exact: true })",
  "GEKTA_FRESH_LOGIN_MFA=PASS",
  "production.gekta.first-user.acceptance.v1",
]);

forbid('executor', [
  /x-registration-delivery-key/iu,
  /registrationDeliveryKey/iu,
  /DATABASE_URL/iu,
  /\b(?:psql|ssh)\b/iu,
  /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?(?:auth\.|public\.|gekta_)/iu,
  /body:\s*\{\s*action:\s*'complete'/iu,
  /SMS|payment|billing|acquir|NPD|НПД/iu,
  /console\.(?:log|error)\(\s*(?:email|password|secret|token|backup|cookie)\b/iu,
]);

requireAll('live', [
  '/api/gekta/entitlement',
  '--data \'{"action":"reserve"}\'',
  'x-gekta-answer-ticket: $answer_ticket',
  '-c "$cookie_jar" -b "$cookie_jar"',
  '"complete":true',
]);

forbid('live', [
  /(?:echo|printf)[^\n]*(?:answer_ticket|cookie_jar|reserve_body)/iu,
]);

requireAll('runbook', [
  '/production gekta-first-user current-main',
  '10 бесплатных ответов',
  'реальное verification-письмо',
  '30-дневный trial',
  'https://процент-агро.рф/gekta/console',
  'поиск по телефону',
  '7 дней',
  '30 дней',
  'бессрочный доступ',
  'logout/login',
  'SMS',
  'billing',
  'DECLARED',
]);

const scope = JSON.parse(source.scope);
if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') throw new Error('scope: schemaVersion');
if (scope.branch !== 'ops/production-gekta-runtime-20260813') throw new Error('scope: branch');
if (scope.productionHosting !== 'REG_RU_EXISTING_INFRASTRUCTURE_ONLY') throw new Error('scope: hosting');
if (scope.boundaries?.newRecurringCostRub !== 0) throw new Error('scope: recurring cost');
if (
  scope.boundaries?.databaseMutation !== 'EXACT_RELEASE_MIGRATIONS_AND_SYNTHETIC_GEKTA_ACCEPTANCE_ONLY'
  || scope.boundaries?.sessionMutation !== true
  || scope.boundaries?.mfaMutation !== true
  || scope.boundaries?.syntheticAccountMutation !== true
  || scope.boundaries?.ownerEntitlementMutation !== true
) throw new Error('scope: production acceptance mutation boundary');
for (const file of Object.values(files)) {
  if (!scope.allowedPaths.includes(file)) throw new Error(`scope: missing allowed path ${file}`);
}

requireAll('scope', [
  'OWNER_ONLY_EXACT_MAIN_REAL_MAIL_BROWSER_ACCEPTANCE',
  'no reviewer password, owner password or TOTP secret enters GitHub Actions',
  'only a synthetic run-scoped phone locator may be published for the visible owner ceremony',
  'billing remains disabled',
]);

console.log('PASS: exact-main owner-only Gekta production acceptance proves ten live durably admitted anonymous answers, the registration boundary, real mail verification, mandatory MFA, a 30-day trial, declared phone, server history/search/projects, visible owner phone search and 7/30/lifetime grants, then logout and fresh MFA login without retaining credentials or PII.');
