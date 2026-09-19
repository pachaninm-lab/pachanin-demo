# Review current task — IR-20 Canonical Durable Outbox

Maturity: controlled-pilot / pre-integration.
Do not overstate maturity or imply live external integrations.
Do not change apps/landing, production UI, visual/theme/onboarding, adapters, server actions, AI gateway runtime, DB/migrations or lockfiles unless the current step explicitly allows it.
Do not auto-merge. Independent review and green checks are required before a manual SHA-bound merge.

Review the diff, not the agent report.

## Required scope checks

- `apps/landing` diff must be 0.
- UI/visual/theme/onboarding diff must be 0 unless explicitly allowed by the current step.
- adapters/server-actions/AI gateway diff must be 0 unless explicitly allowed by the current step.
- no auto-merge behavior.
- no fake-live or maturity overclaim.

## Current allowed scope

- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/outbox/**
- apps/api/src/common/prisma/outbox-*
- apps/api/src/outbox-worker.ts
- apps/api/src/outbox-worker.module.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.spec.ts
- apps/api/src/modules/integration-events/durable-outbox.worker.ts
- apps/api/src/modules/integration-events/integration-events.module.ts
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260912*_canonical_durable_outbox/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/durable-outbox.e2e-spec.ts
- apps/api/test/industrial/outbox-worker-process.e2e-spec.ts
- infra/sql/postgresql-outbox-worker-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

## Transition guard

- BLOCKED: IR-20 Canonical Durable Outbox is not green/closed/mergeable. Dispatcher will not advance to IR-21 Durable Integration Inbox.

## Queue snapshot

# platform-v7 Industrial Integration Readiness queue

CURRENT: IR-20 Canonical Durable Outbox

GOVERNING SPECIFICATION:
- `docs/platform-v7/autopilot/industrial-integration-readiness-v1.0.md`
- target gate: Industrial Integration-Ready;
- current gate: NO-GO;
- exact baseline: `576d813c2d305efb645c9d26fa81a38fb6e4abbe` on `main`.

BASELINE PROVEN:
- persistent identity, session rotation/revocation, MFA and one-time backup codes are merged with isolated PostgreSQL evidence (#2276, #2280, #2282, #2283);
- separate restricted auth and deal PostgreSQL principals are merged (#2287);
- canonical Deal command execution, idempotency, optimistic concurrency, callback authority, transactional audit/outbox creation and isolated recovery evidence are merged (#2260, #2270, #2274, #2378, #2406, #2407);
- Documents PostgreSQL Authority is merged (#2410);
- Logistics PostgreSQL Authority is merged (#2412);
- Labs PostgreSQL Authority is merged (#2426, merge `576d813c2d305efb645c9d26fa81a38fb6e4abbe`, verified head `73149bb4fba09a33875311faea313bb2ad272503`);
- Settlement PostgreSQL Authority is merged (#5338, merge `9dbff1a67225a006ec5f33ebe7fa8b483a368718`, verified head `686c89f6cf2438baebb01f6bf4abcafb3eb85963`) with production-like Kubernetes evidence only; no live bank or REG.RU deployment is claimed;
- Disputes PostgreSQL Authority is exact-main revalidated at `397e98955d9f98704c40befd0088a1390556e0fa` by workflow run `34726015616` and artifact digest `sha256:01c713e0487c3ad040aca44e7d6631063a0788e60be4cc77a5de1097f12bdc60`; this is PostgreSQL 16 CI evidence only, not production acceptance;
- bank callback reconciliation and key rotation/revocation mechanics exist (#2379), but live bank and nominal-account integration remain open;
- CI-scale correctness and isolated backup/restore remain evidence only and do not prove production capacity, HA or provider DR.

CURRENT GOAL:
- preserve the already PostgreSQL-authoritative enqueue service and absent legacy relay/memory store;
- remove the second DurableOutboxRunner from the API process and enforce the dedicated worker as the only delivery owner;
- make PENDING, PROCESSING, RETRY, SENT or CONFIRMED, and DEAD transitions PostgreSQL-authoritative using DB time, bounded leases and `SKIP LOCKED`;
- persist attempts, classified failure code/category and retry timing;
- isolate ambiguous post-send outcomes from automatic retry and require governed reconciliation or redrive;
- support audited redrive, backpressure and graceful shutdown;
- prove concurrent-worker, crash-window, provider-ambiguity, retry, expired-lease, replay, restart and double-owner behavior;
- keep live provider delivery and production deployment outside this PR.

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/src/common/outbox/**
- apps/api/src/common/prisma/outbox-*
- apps/api/src/outbox-worker.ts
- apps/api/src/outbox-worker.module.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.ts
- apps/api/src/modules/integration-events/durable-outbox.runner.spec.ts
- apps/api/src/modules/integration-events/durable-outbox.worker.ts
- apps/api/src/modules/integration-events/integration-events.module.ts
- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20260912*_canonical_durable_outbox/**
- apps/api/test/industrial/harness.ts
- apps/api/test/industrial/durable-outbox.e2e-spec.ts
- apps/api/test/industrial/outbox-worker-process.e2e-spec.ts
- infra/sql/postgresql-outbox-worker-policies.sql
- scripts/platform-v7-forward-only-migration-check.mjs
- scripts/platform-v7-one-deal-e2e.sh
- .github/workflows/ci.yml

CURRENT CRITERIA:
- one dedicated durable outbox owner replaces the legacy relay and process-memory production paths;
- DB-time leases, `SKIP LOCKED`, attempts, classified failures, retries, DEAD state and audited redrive are PostgreSQL-authoritative;
- concurrent workers, crash windows, provider ambiguity, timeout/429/4xx/5xx, expired leases, duplicate enqueue, restart and double-owner startup fail safely;
- exact-head CI passes without claiming production deployment or provider delivery.

LOCKED:
- IR-21 Durable Integration Inbox;
- IR-22 Persistent Partner API and Outbound Webhooks;
- IR-30 through IR-90 in dependency order.

NEXT:
- Layer: IR-21 Durable Integration Inbox
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
  - apps/api/src/modules/regulatory-integration/**
  - apps/api/src/modules/integration-events/integration-events.module.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/*_regulatory_integration_inbox/**
  - apps/api/test/industrial/regulatory-integration-inbox.e2e-spec.ts
  - infra/sql/postgresql-regulatory-integration-inbox-policies.sql
  - scripts/verify-pc-crop-07a.mjs
  - .github/workflows/pc-crop-07a.yml
- Success criteria:
  - provider identity, provider event ID, tenant mapping, raw-body hash, schema/mapping/key versions, DB receive time, verification, attempts, correlation and linked operation are durable facts;
  - signatures are verified over raw bytes, replay windows and key lifecycle fail closed, and HTTP acknowledgement is separated from domain processing;
  - unknown schemas quarantine safely and audited redrive cannot bypass verification or tenant authority;
  - exact-head CI passes without claiming live FGIS/provider activation or production delivery.
- Readiness remains NO-GO.

TRANSITION RULE:
- one narrow PR at a time in dependency order;
- no auto-merge;
- no self-modifying workflow or direct push to `main`;
- advance only after exact-head checks and diff review;
- update state, queue, progress and prompts after merge before opening the next work package;
- mock, simulator and CI-scale evidence remain explicitly labelled and cannot be used as live or production acceptance.

RF REGULATED-CONTOUR BOUNDARY:
- preserve replaceable infrastructure boundaries and a deployment profile capable of using software from the Russian software register where the customer or system classification requires it;
- public foreign images, including MinIO images from Quay, are dependency sources for the disposable production-like acceptance contour only and are not evidence of Russian-software-register status;
- 44-FZ/223-FZ procurement, significant CII, regulated financial activity and a concrete FGIS require separate legal classification and verified domestic/certified software, protection and cryptography controls before any compliance claim;
- no current repository, CI or production-like result proves certification, Russian cryptography activation or regulated-contour acceptance.

READINESS:
Industrial Integration-Ready remains NO-GO until every mandatory gate through IR-90 has commit-, deployment- and operations-linked evidence.

## Historical conditional Qwen diagnostics — 2026-09-12

Archived instruction only. The current provider-independent policy below retires this PR-review workflow; this record grants no current implementation authority.

This is preliminary instruction alignment for future branch
`fix/local-qwen-failed-review-evidence-20260912`, not current implementation
permission. Implementation is permitted only after the immutable prior authority
proposed in PR #5335 is accepted and merged into `main`, and the implementation
base's trusted scope authorizes that exact branch and both paths below. This
paragraph does not change state or expand any permission; primary tasks and all
other scope boundaries remain unchanged.

The future implementation is limited to exactly:

- `.github/workflows/local-qwen-independent-review.yml`
- `docs/platform-v7/autopilot/verify-pr-review-gate.test.mjs`

Preserve bounded rejected-candidate diagnostics before policy-validation failure
can discard them, including evidence transfer before the final failure exit.
Bind evidence to the exact head/run/attempt/diff/manifest/chunk identity and
verify content hashes. Reject invalid UTF-8 and envelopes exceeding 64 KiB.
Preserve the original failure result, fail-closed behavior and cleanup of remote
and unvalidated temporary files. Add no
model calls and change no review semantics, model selection, policy, status or
merge/review gates. Diagnostic artifacts are not accepted review evidence.

Proceed only when that prior authority and base-scope match are independently
verified; otherwise keep this implementation blocked.

## Historical paused concurrent W1 acceptance — 2026-09-12

The following is the recorded state on 2026-09-12, not a fresh status or an active provider requirement.

W1 PR #5332 at `ff03424d073e97d52f1a8cf38dad3de74345ed08` remains
blocked by current Qwen policy-validation failure and Octopus community quota.
Its successful native review and code/security checks do not override those
provider failures. W1 is safely paused without production completion, must not
be retried merely to obtain PASS, and does not alter the serialized IR-10.5 scope.
Confirmed master production acceptance remains 0/100 (0%).


## Owner-authorized provider-independent review — 2026-09-18

The owner's later explicit instruction removes the Codex blocking dependency and authorizes a durable provider-independent review policy. This supersedes the earlier same-day plan that required #5422 followed by a four-path `fix/provider-neutral-review-admission-20260918` PR while retaining native Codex/Copilot authority. That earlier plan and its observed provider failures are historical; they are not prerequisites for this owner-authorized migration. MASTER v2.1 R0.2 provider selection is superseded only for development review. Independent review, engineering quality, exact-SHA evidence and production acceptance remain required. Qwen remains confined to Gekta; Gekta inference, models, evaluation and production runtime are unchanged.

The newly authorized migration is one narrow PR on `fix/provider-independent-review-20260918`, limited to its exact scope manifest: review policy and prompts, the deterministic readiness verifier and its regressions, removal of mandatory PR-provider workflow entry points, retirement of automated merge behavior, and the scope enforcement needed for these exact paths. This grants no additional product, database, dependency, deployment or secret-access scope. The migration itself requires actual independent review of its current diff, fresh applicable CI/security and a manual SHA-bound merge under existing GitHub protections. It does not depend on a native AI provider producing a review event.

Current review contract:

- No named AI provider, quota, account plan, model endpoint or hosted review service is a mandatory dependency. Optional AI review findings remain review findings and must be addressed when applicable.
- An independent human or a separate session review agent must inspect the actual exact-head diff. The implementation author cannot supply their own independent review. Record the full head SHA, reviewer identity and independence, reviewed scope, checks, limitations and findings. Session review is recorded as session review, never forged as native GitHub bot or human approval.
- The deterministic engineering-readiness check retains exact-head identity, complete applicable substantive CI/security checks, implementation-owner exact-head audit, active latest `CHANGES_REQUESTED` and unresolved current review-thread blocking. No provider failure can conceal a substantive failure or resolve a finding.
- `--manual-readiness` can return `READY_FOR_MANUAL_REVIEW`; this is a readiness result, not independent-review PASS or merge permission. The default CLI returns `AUTOMATIC_MERGE_DISABLED`. Missing or stale independent review must be resolved through a real reviewer before a manual merge.
- Automated merging and label-based merge authority are disabled. Immediately before a manual merge, the authorized operator verifies the independent review, reloads current head and readiness, and supplies the full expected head SHA. Existing GitHub branch protections apply; no force merge, fabricated checks or approval impersonation is permitted.
- A head change invalidates previous review, owner audit and CI evidence. Provider retirement does not transfer historical PASS, dismiss findings or claim production acceptance.

Required regressions: absent, rate-limited and retired AI providers cannot block otherwise valid manual readiness; readiness never enables automatic merge; missing or stale owner audit, malformed or incomplete check metadata, red/pending substantive CI, active changes-requested and unresolved review threads still block. Preserve meaningful exact-head and workflow-run authority coverage, including the distinction between transport failure and malformed metadata. Negative evidence must not become PASS because a provider is retired.

Execution sequence: independently review and manually merge this owner-authorized migration after fresh applicable CI; verify live main; reassess #5422 and #5406 against that main and preserve their still-needed scope-enforcement and check-run-authority fixes without reintroducing provider binding; then forward-sync #5347, reuse the saved app_outbox transaction-local claim-protocol fixture, and obtain full CI plus real Production-like Kubernetes Acceptance PASS before its independent review and manual SHA-bound merge. Every remaining change stays in a separately approved narrow scope.

IR-20 remains active. Its final closure requires the exact-current-main REG.RU release, verified immutable running images and canonical production Compose topology, functional live acceptance for the touched outbox flow, and at least 30 minutes of observation required by MASTER. Worker publication, protected release and rollback work require their own reviewed scopes and operational evidence. Local patches, independent review, green CI, a Kubernetes PASS, image publication and a merge do not by themselves constitute `PRODUCTION_PASS`. No IR-21 or other product delivery slice opens before the required IR-20 acceptance is complete.

## Proposed bounded workspace recovery — 2026-09-19

Status: PROPOSED / NOT ACTIVE. Related discovery: #5371 and #5372.
This records a reviewable scope delta requested by the owner's instruction to
continue cabinet UX work. It does not assert approval of an IR-20 sequencing
exception. Merging this planning text alone does not authorize implementation,
open a product slice, change allowedCurrentScope or establish production acceptance.

Before: product delivery remains locked until IR-20 acceptance.
Proposed after: allow only the read-only workspace recovery described below on
a separately admitted branch, while IR-20, provider activation and REG.RU release
requirements remain unchanged. Reason: valid authoritative queue data currently
loses an actionable blocker or makes an entire cabinet unavailable.
Decision needed: explicitly accept or reject this bounded sequencing exception;
if accepted, record the exact branch and paths in trusted main scope authority
before implementation. Do not derive authority from this proposal or from a
scope manifest added by the implementation branch itself.

Evidence baseline: main `126f4b17f0be87eab07a238dc3ffee35a4b8ed8b`.
The following are isolated source-behavior reproductions, not live incidents,
fixed-test results, complete CI or deployment evidence:

- `apps/web/lib/first-customer-workspace-server.ts`, blob
  `14ebf994f43c3eb4c682aa1bfee1ac4885ccd7c1`: queueItem accepts blocker arrays
  but drops a non-empty string blocker when nextAction is absent.
- `apps/api/src/modules/logistics/prisma-shipment.repository.ts`, blob
  `bd5f7af2955f7abb874d170f7ac14d520c122c81`: list returns at most 500
  shipments, preserving the repository's string-or-null blockers field.
  The workspace rejects any array longer than 100. A valid 101-row response
  therefore becomes unavailable.
- Existing production routing selects the first-customer workspace. These
  observations do not prove that legacy demo balances are displayed in production.

Proposed implementation branch: `fix/first-customer-workspace-recovery-20260919`.
Proposed exact scope, subject to the admission decision:

- `apps/web/lib/first-customer-workspace-server.ts`
- `apps/web/components/platform-v7/FirstCustomerWorkspace.tsx`
- `apps/web/tests/unit/firstCustomerWorkspaceSnapshot.test.ts`

Acceptance for the proposed implementation:

1. Preserve explicit authoritative nextAction precedence. Fall back to a
   non-empty string blocker or the first valid blocker in a legacy array.
   Trim and bound text; never invent an action from a status label.
2. Accept the documented bounded logistics list without treating row 101 as a
   transport outage. Keep a hard bound and reject malformed rows. Do not silently
   slice data, assume every endpoint shares the same list contract, or call a
   bounded response a complete workload.
3. Distinguish the displayed queue window from a complete count. If completeness
   cannot be established from server metadata, say so in the workspace and do
   not label the first row the globally highest-priority action. Any navigation
   offered for additional work must point to a verified existing authorized route.
   This slice does not introduce or pretend to implement server pagination.
4. Preserve role/tenant checks, owner-controlled behavior, no-store authenticated
   reads, forbidden versus unavailable states, empty-state semantics and the
   canonical deal execution URL. No synthetic items, balances or provider status.
5. Test the actual workspace loader with mocked authenticated upstream responses:
   string/array/null/whitespace blockers, explicit action precedence, valid 100,
   101 and 500 shipment rows, oversized and malformed responses, role mismatch,
   upstream 403/5xx, empty success and unchanged owner-controlled behavior.
   Verify the queue-window notice against its rendered component.
6. Require applicable exact-head CI, implementation-owner audit and independent
   full-diff review before manual SHA-bound merge. No auto-merge or forged review.
   Verify production separately under the canonical REG.RU release procedure.

Out of scope: bank instructions and payment state, SettlementBasis authority,
FGIS adapters/projections, schema/migrations, auth or registration changes,
dependencies/lockfiles, public pages, landing, release workflows and IR-20 code.
Risk: accepting a larger response can mislead users about completeness; explicit
window semantics and bounded validation are mandatory parts of the same slice.
Progress: two defects reproduced; zero product changes or production acceptance
claimed by this proposal. Revalidate source contracts after any main change.

Subsequent role-settings work remains under #5372 and requires its own scope:
farmer, buyer, logistics, driver, elevator, laboratory, surveyor, bank/accounting
and organization employees. Each role needs a documented entry point, available
commands, permissions, personal versus organization settings, inheritance,
effective time, workflow impact, reset semantics and recovery states. Bank and
FGIS settings must show authoritative connection/capability state; displaying a
setting must never imply provider activation. Do not replace these acceptance
criteria with an unsupported claim of compliance with every global standard.

## Owner-approved bounded workspace recovery — 2026-09-19

The owner explicitly answered "Разрешаю" to the request to fix the two workspace
defects before IR-20 completion while preserving all checks and release conditions.
This supersedes the pending sequencing decision in the proposal above, solely
for that bounded recovery. It does not authorize the broader UX, bank or FGIS backlog.

Record the implementation branch `fix/first-customer-workspace-recovery-20260919`
in approvedConcurrentScopes with the three proposed application/test paths plus
the strictly bounded CI test registration described below.
Governance and implementation remain separate reviewable changes. A draft may be
prepared against this governance branch under the owner's explicit authorization;
do not merge the implementation before this admission reaches trusted main and its
exact-head review/CI gates pass. No additional owner continuation prompt is needed.

Before: discovery only, product work waits for IR-20.
After: owner-authorized preparation and reviewed admission of the two bounded fixes;
IR-20 remains active and all production release/acceptance requirements remain.
Reason, risks, regression matrix and exclusions are those in the proposal above.
Progress means implementation/review evidence only, never IR-20 PRODUCTION_PASS.

### Required CI registration for the approved recovery

Implementation detail discovered during validation: the repository coverage gate
requires every new unit test to be explicitly executed by CI. The three-path
proposal omitted that registration and would fail UNACCOUNTED_TEST_FILE.
The approved two-defect fix therefore also includes exactly one change in
`.github/workflows/ci.yml`: append
`tests/unit/firstCustomerWorkspaceSnapshot.test.ts` to the existing web-unit
Vitest invocation. No trigger, permission, runner, gate, dependency, exclusion,
release workflow or other command changes are admitted. This is required test
wiring for the already authorized fixes, not another product capability.
Before: three implementation paths, new regression not executed by CI.
After: four paths, the same regression runs on subsequent qualifying PRs.
Risk: CI-list omission leaves regression unprotected; coverage guard and the
existing web-unit test selection must pass. Readiness/production claims unchanged.


## Review brief

Review IR-20 Canonical Durable Outbox strictly against the state allowed scope and queue.

Return PASS or BLOCKED. If BLOCKED, include blocker, file, why risk and exact fix.

## Owner-authorized bounded industrial-load diagnostics — 2026-09-19

PR #5436 exact head f3ab1a37583dc20845ee07062a87abca8b86b305 failed
CI run 35461479056 / job 105946017745: one of twelve concurrent Deal cycles
rejected. AggregateError output hides the nested cause and failing phase.
Adjacent transaction-conflict warnings are not proof of the rejected cause.
The owner explicitly authorized the proposed separate diagnostic PR.

Admit branch `test/industrial-load-diagnostics-20260919` for exactly
`apps/api/test/industrial/load-proof.e2e-spec.ts`. Permit bounded, redacted
failure diagnostics with controlled fixture index, action/phase and attempt,
and diagnostic regression assertions within that existing test file.
Never log raw error messages/stacks, SQL, payloads, credentials, tenant/user
identifiers, bank references or arbitrary provider data. Use allowlisted error
classification and safe scalar codes; unknown values remain unknown.
Preserve AggregateError rejection, all twelve default concurrent Deal cycles,
existing retry counts/backoff, timeouts and every existing business assertion.
No runtime, money, settlement, outbox, harness, workflow or dependency changes.

Governance and implementation remain separate. A diagnostic draft may be
prepared against this admission; do not merge it before admission reaches
trusted main. Exact-head independent review, owner audit and substantive CI
remain mandatory. Diagnose on disposable PostgreSQL; an unrelated green rerun
cannot explain the original rejection. If diagnostics reveal a runtime defect,
obtain a separately bounded admission before changing that runtime.
IR-20 remains active in its own execution lane; no delivery or progress gate
is advanced here. This does not expand the four-file workspace repair scope.
Before: opaque rejected cycle blocks acceptance. After: diagnostic permission
only, not a claim that the failed cycle or the workspace release is accepted.
Virtual-server deployment: not required for this test-only admission.

### Atomic diagnostic scope enforcement (supersedes permission-only #5451)

The owner's 2026-09-19 session authorization to implement the specification
includes preparing this necessary bounded guard repair. No earlier machine
admission for this seven-file bootstrap is claimed. Native findings on #5448
and #5451 correctly reject the legacy union with global IR-20 scope.
Bootstrap is limited to governance/industrial-load-diagnostics-20260919 at
base 6d3aef5370a7ef6c46f82d9147f1c3c39e41e206 and state blob
78c82dce0e18e867c43c6a44ddc345a396f241ca. Its exact seven paths are the
four governance documents and guard script, guard tests and guard workflow.
Only the two exact governance/diagnostic scope entries may be appended;
all other state and other execution lanes remain unchanged. Initial candidate
checks are unprivileged, additional to the existing base guard, and require
independent exact-head review and owner audit. They are not retroactive
trusted-base enforcement. Never execute candidate code in pull_request_target.
After merge both branches use immutable trusted-base routing; diagnostic
implementation admits only the load-proof test, with no head-state fallback,
global scope union or generic infrastructure exception. A changed base or an
actual trusted gate rejection requires renewed bounded review/authority,
not disabling checks. No automatic merge or protection changes are permitted.
