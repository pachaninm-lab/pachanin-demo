import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`AUTH_MAIL_CUTOVER_CONTRACT: ${message}`);
};
const has = (text, needle, message = `missing ${needle}`) => assert(text.includes(needle), message);
const lacks = (text, needle, message = `forbidden ${needle}`) => assert(!text.includes(needle), message);

const service = read('apps/api/src/modules/auth/password-reset.service.ts');
const serviceSpec = read('apps/api/src/modules/auth/password-reset.service.spec.ts');
const worker = read('apps/api/src/auth-mail-worker.ts');
const retryPolicy = read('apps/api/src/modules/auth-mail/auth-mail-retry-policy.ts');
const retrySpec = read('apps/api/src/modules/auth-mail/auth-mail-retry-policy.spec.ts');
const smtp = read('apps/api/src/modules/auth-mail/auth-mail-smtp.ts');
const crypto = read('apps/api/src/modules/auth-mail/auth-mail-crypto.ts');
const outbox = read('apps/api/src/modules/auth-mail/auth-mail-outbox.service.ts');
const migration = read('apps/api/prisma/migrations/20260812010000_p0_industrial_auth_mail_outbox/migration.sql');
const webReset = read('apps/web/app/api/auth/forgot-password/route.ts');
const gektaRegister = read('apps/web/app/api/gekta/auth/register/route.ts');
const cutoverWrapper = read('scripts/production-auth-mail-outbox-cutover.sh');
const cutoverCore = read('scripts/production-auth-mail-outbox-cutover-core.sh');
const provision = read('scripts/provision-production-auth-mail-runtime.sh');
const apiDockerfile = read('infra/docker/Dockerfile.api');
const apiTsconfig = read('apps/api/tsconfig.json');
const workflow = read('.github/workflows/production-auth-mail-outbox-cutover.yml');

has(service, 'AuthMailOutboxService', 'password reset must depend on durable auth-mail outbox');
has(service, "kind: 'PASSWORD_RESET'", 'password reset mail kind missing');
has(service, 'await this.mailOutbox.enqueue(tx, {', 'challenge and mail intent must share the repository transaction');
has(service, 'CHALLENGE_ISSUED_MAIL_QUEUED', 'durable queue audit reason missing');
lacks(service, 'delivery: {\n        email:', 'request must not return reset bearer material to Web');
has(serviceSpec, "expect(JSON.stringify(result)).not.toContain('pr_')", 'bearer non-disclosure test missing');
has(serviceSpec, "expect(JSON.stringify(result)).not.toContain('known@example.com')", 'recipient non-disclosure test missing');

has(webReset, '/auth/password-reset/request', 'Web must delegate reset issuance to auth API');
has(webReset, "'x-password-reset-delivery-key': deliveryKey", 'existing server-to-server reset boundary must remain');
lacks(webReset, 'sendTransactionalMail', 'Web password-reset route must not send SMTP directly');
lacks(webReset, 'payload.delivery', 'Web password-reset route must not receive reset bearer delivery payload');
lacks(webReset, 'PC_SMTP_PASS', 'Web password-reset route must not read SMTP authority');

has(gektaRegister, 'sendTransactionalMail', 'Gekta still depends on legacy Web transactional mail');
has(gektaRegister, 'isTransactionalMailConfigured', 'Gekta legacy mail configuration guard missing');

has(worker, 'isRetryableAuthMailFailure', 'worker must classify failures before retry/dead-letter');
has(worker, 'const terminal = !retryable || expired || attemptCount >= entry.max_attempts;', 'permanent failures must dead-letter immediately');
has(retryPolicy, '/^SMTP_PERMANENT_5\\d\\d$/.test(errorCode)', 'SMTP 5xx terminal policy missing');
has(retrySpec, "'SMTP_TRANSIENT_451'", 'observed production 451 must be regression-tested');
has(retrySpec, "'SMTP_PERMANENT_550'", 'permanent 550 must be regression-tested');
has(smtp, "code >= 500 ? 'PERMANENT' : code >= 400 ? 'TRANSIENT' : 'PROTOCOL'", 'SMTP 4xx/5xx response classifier missing');
has(smtp, '`SMTP_${category}_${code}`', 'SMTP response taxonomy missing');

has(crypto, 'aes-256-gcm', 'outbox bearer envelope must use AEAD encryption');
has(outbox, 'auth.enqueue_mail_outbox', 'API must enqueue through bounded database authority');
has(migration, 'ALTER TABLE auth.mail_outbox FORCE ROW LEVEL SECURITY;', 'auth-mail outbox must FORCE RLS');
has(migration, "'pc_auth_mail_runtime'", 'least-privilege worker database principal missing');
has(migration, 'auth.enqueue_mail_outbox', 'security-definer enqueue function missing');
has(migration, 'auth.redact_terminal_mail_outbox', 'terminal ciphertext retention redaction missing');

has(apiTsconfig, '"src/**/*.ts"', 'API compiler must include auth-mail-worker entrypoint');
has(apiDockerfile, 'cp -R /workspace/apps/api/dist /prod/api/dist', 'API image must carry compiled worker entrypoint');

has(cutoverWrapper, 'EXPECTED_CORE_BLOB="d45f60d0feb10c569b2c4388214aae41be508fd1"', 'wrapper must pin reviewed cutover core');
has(cutoverWrapper, 'PATCH_CARDINALITY_', 'wrapper transformation must fail closed on source drift');
has(cutoverWrapper, 'PC_AUTH_MAIL_CUTOVER_VALIDATE_ONLY', 'wrapper local validation mode missing');
has(cutoverWrapper, 'LEGACY_WEB_TRANSACTIONAL_MAIL_AUTHORITY=PRESERVED', 'legacy Web mail preservation evidence missing');
has(cutoverWrapper, '- ${transactional_mail_env_file}', 'wrapper must preserve legacy Web transactional-mail env file');
has(cutoverWrapper, "grep -Eq '^AUTH_MAIL_'", 'Web must not receive worker-specific AUTH_MAIL authority');

has(cutoverCore, '/app/dist/apps/api/src/auth-mail-worker.js', 'pre-mutation worker artifact proof missing');
has(cutoverCore, 'restore_baseline()', 'cutover core must carry rollback routine');
has(cutoverCore, 'trap on_error ERR', 'cutover core must fail-closed into rollback');
has(cutoverCore, 'AUTH_MAIL_WORKER_READY=PASS', 'production evidence must prove worker readiness');
has(cutoverCore, 'AUTH_MAIL_DATABASE_URL_FILE: /run/pc-auth-mail/database-url', 'worker database authority must be file-mounted');
has(cutoverCore, 'AUTH_MAIL_TRANSPORT_FILE: /run/pc-auth-mail/transport.env', 'worker SMTP authority must be file-mounted');
has(cutoverCore, '- ${gekta_api_runtime_env_file}', 'cutover must preserve current Gekta API runtime authority');
has(cutoverCore, '- ${gekta_web_runtime_env_file}', 'cutover must preserve current Gekta Web runtime authority');
lacks(cutoverCore, 'docker system prune', 'cutover must not perform unbounded Docker cleanup');
lacks(cutoverCore, 'docker volume prune', 'cutover must not mutate unrelated volumes');

has(provision, 'pc_auth_mail_runtime', 'provisioning must maintain dedicated worker DB principal');
has(provision, 'AUTH_MAIL_PROVISION=PASS', 'provisioning success evidence missing');

has(workflow, "workflows: ['Production Full-Stack Exact-SHA Release']", 'cutover must chain only after exact full-stack release');
has(workflow, "github.event.workflow_run.event == 'workflow_run'", 'production cutover must reject PR/push-only upstream runs');
has(workflow, "github.event.workflow_run.head_branch == 'main'", 'production cutover must be main-only');
has(workflow, 'git rev-parse origin/main', 'workflow must guard against current-main drift');
has(workflow, 'scripts/check-production-auth-mail-outbox-cutover.mjs', 'workflow contract job missing');
has(workflow, 'scripts/production-auth-mail-outbox-cutover.sh', 'workflow cutover asset missing');
has(workflow, 'scripts/provision-production-auth-mail-runtime.sh', 'workflow provision asset missing');

execFileSync('bash', ['scripts/production-auth-mail-outbox-cutover.sh'], {
  env: { ...process.env, PC_AUTH_MAIL_CUTOVER_VALIDATE_ONLY: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

console.log('AUTH_MAIL_CUTOVER_CONTRACT=PASS');
