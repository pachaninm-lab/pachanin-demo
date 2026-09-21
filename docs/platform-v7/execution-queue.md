# PC-CROP MASTER v2.1 execution queue

CURRENT: R1.3 CEO overview and P0/P1 decision queue

OFFICIAL OVERALL: 5/100 = 5%
TARGET AFTER R1 PRODUCTION_PASS: 12/100 = 12%

CURRENT ALLOWED:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- docs/execution/**
- apps/api/src/app.module.ts
- apps/api/src/modules/founder-control/**
- apps/api/src/modules/staff-access/staff-access.types.ts
- apps/api/prisma/migrations/*_founder_control_center/**
- infra/kind/production-like/postgresql-runtime-grants.sql
- apps/api/test/staff-access/**
- .github/workflows/ci.yml

CURRENT CRITERIA:
- Company Health combines business, operations, finance, risk and system health from real PostgreSQL/domain sources only;
- every metric has source, asOf/freshness, grain/definition, availability and drill-down;
- unavailable/stale/error remains explicit and never becomes fake/zero actual;
- P0/P1 queue has stable identity/version, owner or UNASSIGNED, deadline, impact, next action, escalation and source/evidence;
- PLATFORM_OWNER + current durable assignment + MFA are revalidated for every read;
- no client-selected tenant/role/provider/finality authority and no cross-tenant leakage;
- no PRODUCT UX/FGIS/bank visual implementation.

LOCKED:
- R1.4 financial/commercial Founder metrics until R1.3 is merged with exact-head evidence.
- R1 official 7 points remain 0 until the whole block has PRODUCTION_PASS.

NEXT:
- Layer: R1.4 Cash/runway, pipeline, client P&L, AR/DSO, forecast, retention, hiring and scale gates.
- Allowed files:
  - docs/platform-v7/autopilot/autopilot-state.json
  - docs/platform-v7/autopilot/progress.json
  - docs/platform-v7/autopilot/prompts/current-codex-task.md
  - docs/platform-v7/autopilot/prompts/current-review-task.md
  - docs/platform-v7/execution-queue.md
  - docs/execution/**
  - apps/api/src/modules/founder-control/**
  - apps/api/prisma/migrations/*_founder_financial_control/**
  - infra/kind/production-like/postgresql-runtime-grants.sql
  - apps/api/test/staff-access/**
- Success criteria:
  - actual/plan/forecast remain distinct;
  - cash/runway and AR/DSO derive from authoritative financial sources;
  - client P&L/margin is reproducible from ledger/source rows;
  - retention/pipeline/scale gates do not fabricate missing commercial evidence;
  - all values keep source/freshness/drill-down and explicit unavailable semantics.
- Readiness remains MASTER_R1_IN_PROGRESS.

## R1.1 closed evidence
- exact inventory: `docs/execution/R1_1_EXACT_INVENTORY_2026-09-20.md`
- exact baseline used: `5da8e80744908413102214f91dd68018911b892e`
- canonical 13 cabinet roots are derived from current server role/route authority.
- controlled-test owner shortcut is explicitly excluded from R1 production evidence.
- fragmented role/permission registries are recorded as R1 deltas rather than silently treated as canonical.

## R1 factual baseline
- MASTER: PC-CROP_CODEX_MASTER_TZ_v2.1_2026-09-12.
- R0 = PRODUCTION_PASS.
- IR-20 Canonical Durable Outbox = PRODUCTION_PASS.
- overall remains 5/100 until all R1 requirements pass together.
- Team Hub #5469 is the live cross-contour coordination bus.
- PRODUCT owns visual UX/FGIS/bank surfaces; CORE owns R1 server truth/authority/contracts.

## R1 PASS
R1 remains IN_PROGRESS until REQ-R1-001..005 and REQ-ROL-001..006 are evidenced on one accepted exact SHA, including 13/13 open/read-or-authorized-action/return, denied/high-risk cases, real-data-only Founder metrics with source/drill-down, actual-actor/effective-role audit, PRE_RELEASE_PASS, exact-current-main REG.RU release, exact production identity, live acceptance and required observation. Only then may OVERALL_PRODUCTION_PROGRESS become 12/100 = 12%.

## Historical policy records retained for regression compatibility
The following sections are archival records. Their dated statements such as “IR-20 remains active” describe the state at that historical checkpoint and are superseded by the exact R0/IR-20 PRODUCTION_PASS evidence above. They remain verbatim because review-policy regression tests intentionally verify their preservation.

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

