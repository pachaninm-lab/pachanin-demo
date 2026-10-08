# Current task — atomic canonical readiness prerequisite #4829

Official progress remains **5/100**. Staff-session source #5766 is merged; R1 production acceptance remains open.

The [owner-approved atomic disposition](https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-5935185862) replaces the separate metadata-first/source sequence for this one prerequisite. Use only the existing `fix/readiness-database-deadline-4829` branch with CORE as the existing writer. Preserve original readiness history and proposals #5770 (`056b185503e2db46956d2e6b76b78e936e963b37`) and #5771 (`e358177634856c9e71a0961497e7802f49213485`) through ordinary ancestry.

The complete accepted-base diff must contain exactly these eleven existing regular 100644 files:
- docs/platform-v7/autopilot/autopilot-state.json
- docs/platform-v7/autopilot/progress.json
- docs/platform-v7/autopilot/prompts/current-codex-task.md
- docs/platform-v7/autopilot/prompts/current-review-task.md
- docs/platform-v7/execution-queue.md
- apps/api/test/staff-access/postgresql-staff-access.e2e-spec.ts
- apps/api/src/main.ts
- apps/api/src/health.controller.ts
- apps/api/src/health.controller.spec.ts
- apps/api/src/common/guards/pre-auth-rate-limit.guard.ts
- apps/api/src/common/guards/pre-auth-rate-limit.guard.spec.ts

Adopt all five COR5 source blobs unchanged from original proposal #4829/comment5930247718 and the exact staff-test blob `1b0010715cbcd636d15b1c9c4e5587baca16137c` from #5771/e358. Preserve source attribution to the existing CORE producer and proposal histories. The full source transitions are recorded in `canonical-readiness-cor5-4829-20261001`. Only the five listed governance documents are revised for the atomic disposition; every prior accepted concurrent vector and admission stays unchanged.

No guard, workflow, manifest, PgBouncer configuration, dependency, migration, unrelated source or mode changes. No staff-source/test wildcard expansion. The legacy branch manifest is historical, and standard candidate-list routing is not mechanically immutable exact-eleven enforcement; external owner authority and independent whole-tree review enforce this boundary.

Reuse the canonical HealthController, restricted Prisma principal and OutboxService. Preserve the 1500ms deadline, 15000ms grace, single flight, immediate/late pending-migration invalidation and existing thresholds. Service-wide queue state stays UNKNOWN where RLS hides rows. Probe aliases must not weaken unrelated rate/auth controls.

Require fresh exact-published-head independent nonauthor review of all eleven files, separate implementation-owner audit, all applicable full native CI/security/PostgreSQL and unchanged Kubernetes with zero failed PgBouncer logical probes, complete deep-outbox scenarios and successful cleanup. Preserve old #5770 Security Abuse and #5771 Kubernetes failures; local proposal/composition results never transfer PASS to this head. Report skipped tests and pre-existing aggregate teardown limitations explicitly. Recheck current head, all findings and manual readiness immediately before an ordinary expected-full-SHA merge.

Preserve actual PRODUCT handoff5933030140, accepted purpose3/guard/test/workflow and all other owners; recheck fresh main/Hub before publication or merge. Return an actual handoff and supersede old proposals only after real atomic acceptance. No production, provider activation, R1 completion or progress claim follows from this bundle.

The next priority is the existing Gekta owner's actual model activation and live quality, speed and stability acceptance under its separate existing admissions and remaining topology/release prerequisites. This does not expand these eleven paths. R1.3 remains queued for a separately accepted scope transition; exact-main REG.RU and full 13-cabinet acceptance remain separate.

## Queued snapshot-only topology diagnostic — 2026-10-01

Preserve the entire current task and all existing owners. The bounded approval in [Hub5941557816](https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-5941557816) permits this five-file preparation and a subsequent exact two-file source draft only. It is a reduced continuation of [proposal5934069236](https://github.com/pachaninm-lab/pachanin-demo/issues/5469#issuecomment-5934069236), retaining the existing TAI/preflight owner and #3582 lineage, not a second observer or completed full-model proposal.

After actual admission acceptance, the sole source branch is `fix/tai-bounded-topology-observer-20261001`:
- `scripts/tai-reg-ru-preflight.sh`, mode 100755: `8f0f285bc436f3b4754204d198db5c68a4c916d2` -> `ac60f97dacdaf85ef1ccef63a1ea40709023d509`
- `scripts/check-tai-reg-ru-preflight.mjs`, mode 100644: `15fb496d2aba5b2fda7adc0d55b8caaf8d6d1c79` -> `70071581041d73e8d73f5d61d8699420844cdf86`

Use only the exact source transitions/SHA256 values in `tai-bounded-topology-observer-20261001`. Reuse existing private preflight JSON and ordered input snapshots; preserve every classifier, check, blocker, maturity and passed result. One additional Python collector reads bounded existing private work data/stdin, launches no child process and adds no wall-clock guarantee. No added Docker/Compose evaluation, daemon/image operation, network, source/env/protected-file read or workflow/controller change. Fresh persisted/discovery comparison, immutable-image/default-command evidence, registry provenance and freshness remain NOT_PROVEN.

This five-file admission must wait for explicit closure of the serialized runtime no-main-merge window before governance merge. The subsequent source PR stays draft: source merge and server execution require separate explicit approval because existing automatic build/preflight controllers pull images and refresh protected checkout. Current Gekta diagnostic/runtime authority grants no topology operation. No new rights, credentials, expense or progress credit; official 5/100 and all existing priorities remain unchanged.


## Gekta consent and first-user release prerequisites — 2026-10-08

The renewed user instruction «Делай всё и завершай» and Hub6069284294 continue the existing Gekta/CORE lane. This five-document admission adds only three exact paths to the existing security vector and two exact metadata paths to the existing first-user consent-race vector. It changes no primary/global/current scope, owner, guard, workflow, old admission, source or official 5/100.

Use the state record `gekta-consent-first-user-release-prerequisites-20261008` as the exact payload for two separate source PRs: nine regular security files (current signed consent, actual client consent/quota decision, explicit consent before production smoke generation and tests) and six regular first-user files (complete #4637 journal handoff after the security checker is accepted). Preserve the historical #3072 provisioning authority. The existing candidate-list guard route is not immutable payload enforcement; genuine independent whole-tree review must verify all pinned blobs/modes and reject extras, independently of guard PASS.

Fresh exact-head independent review, separate implementation-owner audit, substantive CI/security/PostgreSQL/Kubernetes and manual readiness precede each ordinary expected-full-SHA source merge. Keep #5836 P2 4224220487 unresolved until the actual client correction is present and independently inspected; consent restriction cannot release with the old pre-consent smoke. Native independent review is optional as a provider but actual review is mandatory. No private test, old head or metadata admission substitutes for source acceptance.

After source acceptance the existing exact-main REG.RU application release remains separate. Actual immutable running revisions, live checks and observation are required. Full first-user PASS additionally requires real mail, user MFA and the visible existing PLATFORM_OWNER fresh-MFA 7/30/lifetime ceremony. No new model grant/service-control permission, registration receipt, purge/schema/history mutation, expense, R1/progress or whole-Gekta completion follows.


## Gekta history import and explicit removal — 2026-10-08

The renewed user instruction «Делай всё и завершай» and Hub6069913751 continue the existing CORE Gekta workspace owner. The separate state record `gekta-history-import-purge-20261008` admits only its ten exact pinned source files on `fix/gekta-history-purge-import-20261008`. Preserve the accepted #5818 soft-delete record/payload/immutable route, every other owner and scope, the primary R1 task and official 5/100. No guard, workflow, global/current scope or runtime source changes occur in this five-document admission.

After actual admission acceptance, compose the source ordinarily with then-current accepted main, verifying the seven unchanged before blobs and the three absent added paths. Stable local IDs, a minimal account-scoped technical receipt and an existing-account row lock make import atomic; explicit delete/clear physically removes owned primary database rows via a fixed-search_path EXECUTE-only purge function, retaining only the declared receipt to prevent restoration. Preserve conditional append/project locks and all existing authentication, role, tenant and RLS authority. No deployment-time bulk deletion or direct runtime DELETE grant. Old-client and pepper-rotation limits and disk/WAL/backup limits are stated explicitly; no legal sufficiency or complete erasure is inferred.

This standard route is not mechanically immutable payload enforcement. Separate actual independent nonauthor whole-tree review must verify every pinned byte/blob/mode and reject all extra changes or candidate scope expansion. Require fresh implementation-owner audit, all applicable native CI/security/Kubernetes and actual automatically selected industrial PostgreSQL concurrency/purge/isolation/rollback cases before fresh canonical manual readiness and ordinary full-expected-SHA merge. Local 110 API/29 web cases, TypeScript and Prisma validation are preparation evidence only. Source acceptance, deployment and whole Gekta/model/registration-consent/owner-MFA closure remain separate; no private or old-head PASS transfers.


## Gekta registration document evidence prerequisite — 2026-10-08

The renewed instruction «Делай всё и завершай» continues the existing CORE/Gekta owner. The actual registration form presents Gekta documents, but the API records the platform's separate pair. Admit only the fourteen exact regular source paths/payloads in state record `gekta-registration-document-evidence-20261008` on `fix/gekta-registration-document-evidence-20261008`, preserving all older #5818/#5837/history admissions, Claude F-06 ownership, primary scope, platform consent policy and official 5/100.

Use the existing rendered Gekta legal documents/actual merchant profile and existing hash-chained auth audit. A short-lived server-signed form commitment binds final public text/hashes, current profile digest, distinct two-checkbox purposes and actual interface/document languages. BFF recomputes current evidence and ignores forged client receipts; API verifies the same commitment over the existing delivery-key boundary before writes. Stale/missing/tampered proof requires refresh and new unchecked choices; committed document links reject stale content. No public legal text/version, second receipt backend, operator fact, withdrawal/store authority or model grant is introduced.

Metadata acceptance precedes source publication. The standard route is not mechanically immutable: real independent whole-tree exact-blob/mode review, separate owner audit, complete native checks and fresh canonical manual readiness are required before ordinary full-expected-SHA manual source merge. Local 23 API/36 web/typechecks and production build (captured exit 0) passed; these are not native current-head acceptance. Actual exact-main release/identity/live acceptance remain separate. The generated crypto catalogue and existing delivery-key purpose map also bind actual registration source; its catalogue prerequisite is accepted corrected history, not a future main claim. Anonymous full-document binding, registered withdrawal, legal/operator review, physical purge/backup retention, model activation/service control and real owner MFA/grants still remain open; this receipt fix is no whole-Gekta/R1/progress claim.


## Gekta distinct bounded candidate grant prerequisite — 2026-10-08

The renewed owner instruction «Делай всё и завершай» and the concrete operator record #3896/6070851050 authorize preparation of a separately admitted fresh one-use grant, not resetting `gekta-critical-5974230017`. Admit only state record `gekta-candidate-oneuse-grant-20261008` and its three pinned regular paths on `fix/gekta-candidate-oneuse-grant-20261008`, with the existing CORE/Gekta owner and every accepted/history/registration/Claude F-06 scope and official 5/100 preserved. This admission is distinct from registered-document evidence; neither changes the other's payload.

`gekta-finish-20261008-4b-oneuse` permits one critical corpus and at most one extra corpus after actual same-source critical PASS, cleanup PASS and healthy unchanged 8B inspection. Keep all current non-root/pinned-host/loopback/immutable-artifact/resource/pidfd/420s lease/cleanup/exclusive durable marker guards. Explicit new-grant plus full-current-main owner commands are required; old commands/grant cannot consume new slots. Retired markers stay untouched; failure/cancellation/new source/new run never refunds either slot. Local 20 marker cases, 16 diagnostic cases, OS identity/pre-exec and actual command-capture fixtures passed without model inference; the ownership/watchdog real-child fixture is blocked locally by UID0 and must pass in native non-root CI.

Accepted five-document admission precedes source publication. Require genuine independent whole-tree pin/mode review, separate exact-head owner audit, complete native current-head checks and canonical readiness before an ordinary full-expected-SHA manual merge. Only then may an actual owner command start a granted bounded window. Inspect actual 10 critical/4 extra same-source receipts; selected-corpus reports remain PARTIAL and marker existence proves only spending. There is no automatic retry, recurring budget, paid activation, service mutation, root/sudo/polkit bypass, production secret/role change or candidate public routing. Permanent model replacement remains separately blocked by control capability; no candidate/private/metadata PASS closes whole Gekta or progress.


## Gekta history acceptance correction prerequisite — 2026-10-08

Actual independent #5841/4225107297 P1 found that legacy import receipts can disappear across auth pepper rotation and allow deleted history to return. Native jobs113587406516/113587407904 also block the additive purge function's DELETE definition and stale crypto catalogue. Real PostgreSQL job113587406241 passed seven of eight new history cases, but its import/clear case failed because object spread omitted transaction raw-query methods; overall industrial FAILED133/1/117, never acceptance.

Before updating this red unaccepted source, admit state record `gekta-history-acceptance-correction-20261008`: the full thirteen-path exact regular payload on existing `fix/gekta-history-purge-import-20261008`, with only three paths appended to its scope. Preserve original merged #5839 record, every previous owner/source/scope/Claude F-06 and official5/100. The correction uses account/purpose SHA-256 technical identifiers independent of auth pepper, retaining no plaintext and disclosing hash guessability/retention. It proxies the actual PostgreSQL transaction so its FOR UPDATE and independent clear still execute, and adds two unit plus two real database rotation cases. No mock/skip/timeout widening or privacy/erasure credit.

The migration gate allows only the entire pinned additive SQL digest under its exact name, for its function definition alone; any changed byte/name, deployment invocation, extra deletion or other destructive rule fails. Six actual CLI behavioral cases remain in an already-run API suite. The generated crypto catalogue remains maintained, with no floor weakening. Local API138/TypeScript/crypto8 passed; all ten corrected PostgreSQL cases, fresh independent review with P1 resolved, complete substantive native/security/Kubernetes and canonical readiness are required before an ordinary exact-full-SHA source merge. Registration's two extra catalogue/key-purpose paths depend on the genuinely accepted corrected history catalogue before publication. Nothing here accepts a red source head, invokes purge in deployment, creates a new owner/backend or changes permanent model/MFA/production/progress authority.
