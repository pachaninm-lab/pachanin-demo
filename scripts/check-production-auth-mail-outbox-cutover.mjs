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
const releaseController = read('.github/workflows/platform-v7-safe-merge.yml');

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

has(gektaRegister, 'sendTransactionalMail', 'shared Web transactional mail still has non-migrated callers');
has(gektaRegister, 'isTransactionalMailConfigured', 'shared legacy mail configuration guard missing');

has(worker, 'isRetryableAuthMailFailure', 'worker must classify failures before retry/dead-letter');
has(worker, 'const terminal = !retryable || expired || attemptCount >= entry.max_attempts;', 'permanent failures must dead-letter immediately');
has(retryPolicy, '/^SMTP_PERMANENT_5\\d\\d$/.test(errorCode)', 'SMTP 5xx terminal policy missing');
has(retrySpec, "'SMTP_TRANSIENT_451'", 'observed production 451 must be regression-tested');
has(retrySpec, "'SMTP_PERMANENT_550'", 'permanent 550 must be regression-tested');
has(smtp, "code >= 500 ? 'PERMANENT' : code >= 400 ? 'TRANSIENT' : 'PROTOCOL'", 'SMTP 4xx/5xx response classifier missing');
has(smtp, '`SMTP_${category}_${code}`', 'SMTP response taxonomy missing');
has(smtp, 'function isPlatformAuthMailbox(address: string): boolean', 'SMTP auth mailbox domain guard missing');
has(smtp, '!isPlatformAuthMailbox(user)', 'SMTP auth login must remain inside the platform domain');
has(smtp, 'from !== PLATFORM_SENDER_ASCII', 'MAIL FROM must remain the canonical platform sender');
lacks(smtp, 'user !== PLATFORM_SENDER_ASCII || from !== PLATFORM_SENDER_ASCII', 'SMTP AUTH login must not be collapsed into MAIL FROM');

has(crypto, 'aes-256-gcm', 'outbox bearer envelope must use AEAD encryption');
has(outbox, 'auth.enqueue_mail_outbox', 'API must enqueue through bounded database authority');
has(migration, 'ALTER TABLE auth.mail_outbox FORCE ROW LEVEL SECURITY;', 'auth-mail outbox must FORCE RLS');
has(migration, "'pc_auth_mail_runtime'", 'least-privilege worker database principal missing');
has(migration, 'auth.enqueue_mail_outbox', 'security-definer enqueue function missing');
has(migration, 'auth.redact_terminal_mail_outbox', 'terminal ciphertext retention redaction missing');

has(apiTsconfig, '"src/**/*.ts"', 'API compiler must include auth-mail-worker entrypoint');
has(apiDockerfile, 'cp -R /workspace/apps/api/dist /prod/api/dist', 'API image must carry compiled worker entrypoint');

has(cutoverWrapper, 'CORE="${PC_AUTH_MAIL_CUTOVER_CORE:-scripts/production-auth-mail-outbox-cutover-core.sh}"', 'wrapper must accept an explicit remote core path');
has(cutoverWrapper, 'EXPECTED_CORE_BLOB="d45f60d0feb10c569b2c4388214aae41be508fd1"', 'wrapper must pin reviewed cutover core');
has(cutoverWrapper, 'PATCH_CARDINALITY_', 'wrapper transformation must fail closed on source drift');
has(cutoverWrapper, 'LEGACY_SMTP_LOGIN_SENDER_SEPARATION', 'legacy transport normalization must separate SMTP login and sender');
has(cutoverWrapper, 'AUTHORITY_LOGIN_SENDER_SEPARATION', 'projected worker authority must preserve login/sender separation');
has(cutoverWrapper, "sender != f'access@{platform_domain}'", 'legacy transport must keep canonical MAIL FROM');
has(cutoverWrapper, "user_domain != platform_domain and not user_domain.endswith('.' + platform_domain)", 'legacy SMTP login must remain platform-domain bounded');
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
has(cutoverCore, '- ${gekta_api_runtime_env_file}', 'cutover must preserve current API runtime authority');
has(cutoverCore, '- ${gekta_web_runtime_env_file}', 'cutover must preserve current Web runtime authority');
lacks(cutoverCore, 'docker system prune', 'cutover must not perform unbounded Docker cleanup');
lacks(cutoverCore, 'docker volume prune', 'cutover must not mutate unrelated volumes');

has(provision, 'pc_auth_mail_runtime', 'provisioning must maintain dedicated worker DB principal');
has(provision, 'AUTH_MAIL_PROVISION=PASS', 'provisioning success evidence missing');
lacks(provision, 'local version="$1" key_file="$KEYRING_DIR/v${version}.key"', 'provision must not expand local version before assignment under nounset');
has(provision, "user_domain != platform_domain and not user_domain.endswith('.' + platform_domain)", 'provision SMTP login must remain platform-domain bounded');
has(provision, "values['PC_MAIL_FROM'] != f'access@{platform_domain}'", 'provision MAIL FROM must remain canonical');
lacks(provision, "values['PC_SMTP_USER'] != 'access@xn----8sbjf4befbjgs9b.xn--p1ai' or values['PC_MAIL_FROM'] != values['PC_SMTP_USER']", 'provision must not collapse SMTP AUTH login into MAIL FROM');

has(workflow, "workflows: ['Production Full-Stack Exact-SHA Release']", 'legacy exact-release workflow_run chain must remain supported');
has(workflow, 'controller_target_sha:', 'direct controller target SHA input missing');
has(workflow, 'controller_run_id:', 'direct controller run ID input missing');
has(workflow, "github.event_name == 'issue_comment'", 'direct controller event boundary missing');
has(workflow, 'github.event.issue.number == 3072', 'direct controller release issue guard missing');
has(workflow, "github.event.comment.body == '/production release current-main'", 'direct controller command guard missing');
has(workflow, 'github.actor == github.repository_owner', 'direct controller actor guard missing');
has(workflow, 'github.triggering_actor == github.repository_owner', 'direct controller triggering-actor guard missing');
has(workflow, 'inputs.controller_target_sha', 'workflow must consume direct target SHA');
has(workflow, 'inputs.controller_run_id', 'workflow must consume direct controller run ID');
has(workflow, "'production-full-stack-execution-3072 / Validate full-stack release contract'", 'controller full-stack contract evidence check missing');
has(workflow, "'production-full-stack-execution-3072 / Migrate, deploy API and web, verify live intake'", 'controller production rollout evidence check missing');
has(workflow, 'AUTH_MAIL_CUTOVER=FAIL_CONTROLLER_RELEASE_EVIDENCE', 'controller release evidence fail-closed marker missing');
has(workflow, 'AUTH_MAIL_CUTOVER=FAIL_UPSTREAM_PROVENANCE', 'legacy upstream provenance fail-closed marker missing');
has(workflow, 'git rev-parse origin/main', 'workflow must guard against current-main drift');
has(workflow, 'scripts/check-production-auth-mail-outbox-cutover.mjs', 'workflow contract job missing');
has(workflow, 'scripts/production-auth-mail-outbox-cutover.sh', 'workflow cutover wrapper asset missing');
has(workflow, 'scripts/production-auth-mail-outbox-cutover-core.sh', 'workflow cutover core asset missing');
has(workflow, "PC_AUTH_MAIL_CUTOVER_CORE='/tmp/pc-auth-mail-cutover-core-${GITHUB_RUN_ID}.sh'", 'workflow must pass the pinned remote core path');
has(workflow, 'LEGACY_WEB_TRANSACTIONAL_MAIL_AUTHORITY', 'workflow must publish legacy Web mail preservation evidence');
has(workflow, '[[ "$LEGACY_WEB_TRANSACTIONAL_MAIL_AUTHORITY" == PRESERVED ]]', 'final cutover gate must require preserved legacy Web mail');
has(workflow, '[[ "$API_SMTP_AUTHORITY" == ABSENT ]]', 'final cutover gate must require no API SMTP authority');
lacks(workflow, 'WEB_SMTP_AUTHORITY:', 'stale Web SMTP absence evidence variable must be removed');
has(workflow, 'scripts/provision-production-auth-mail-runtime.sh', 'workflow provision asset missing');

has(releaseController, 'production-auth-mail-cutover-3072:', 'owner release controller must chain auth-mail cutover');
has(releaseController, 'exact_main_sha: ${{ steps.release.outputs.main_sha }}', 'release-control exact SHA job output missing');
has(releaseController, 'echo "main_sha=$main_sha" >> "$GITHUB_OUTPUT"', 'release-control exact SHA step output missing');
has(releaseController, 'needs: [production-release-control-3072, production-full-stack-execution-3072]', 'auth-mail cutover must depend on release-control and full-stack release');
has(releaseController, "needs.production-release-control-3072.result == 'success'", 'controller cutover must require release-control success');
has(releaseController, "needs.production-full-stack-execution-3072.result == 'success'", 'controller cutover must require full-stack success');
has(releaseController, "uses: ./.github/workflows/production-auth-mail-outbox-cutover.yml", 'controller must call reusable auth-mail cutover directly');
has(releaseController, 'controller_authorized: true', 'controller authorization input missing');
has(releaseController, 'controller_target_sha: ${{ needs.production-release-control-3072.outputs.exact_main_sha }}', 'controller exact target SHA propagation missing');
has(releaseController, 'controller_run_id: ${{ github.run_id }}', 'controller run ID propagation missing');
has(releaseController, 'github.actor == github.repository_owner', 'controller actor must be repository owner');
has(releaseController, 'github.triggering_actor == github.repository_owner', 'controller triggering actor must be repository owner');
assert(!fs.existsSync('.github/workflows/production-auth-mail-cutover-after-controller.yml'), 'standalone auth-mail bridge must be retired after direct chaining');

execFileSync('bash', ['scripts/production-auth-mail-outbox-cutover.sh'], {
  env: { ...process.env, PC_AUTH_MAIL_CUTOVER_VALIDATE_ONLY: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

console.log('AUTH_MAIL_CUTOVER_CONTRACT=PASS');
